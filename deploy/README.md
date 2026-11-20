# Deploying a demo on Oracle Cloud (free)

This runs the whole stack (Postgres, Ollama, API, web) on one free Oracle Cloud
ARM VM, behind Caddy with automatic HTTPS and a shared password. Setting it up
takes about an hour, most of it waiting for downloads.

```
Internet ──HTTPS──▶ Caddy (password) ──▶ web (nginx) ──▶ api ──▶ Postgres
                    only open ports:                       └──▶ Ollama
                    80, 443 (+ SSH)
```

## What the free tier gives you

Per Oracle's Always Free documentation (check it again; terms change):

- **Ampere A1 compute**: 1,500 OCPU-hours and 9,000 GB-hours per month,
  equivalent to **2 OCPUs and 12 GB of memory**, as one VM (`VM.Standard.A1.Flex`).
- **200 GB** of block storage in total (boot volumes included).
- **10 TB** of outbound data per month.
- Always Free resources must be created in your **home region**, which you
  choose at sign-up.
- **Idle instances may be reclaimed**: if, over 7 days, CPU (95th percentile),
  network and memory all stay below 20%. This setup keeps the models loaded in
  memory (about 3 of 12 GB), which should keep memory above that threshold.

12 GB is plenty for this app. With 2 cores, local answers (qwen2.5:3b) take
about a minute. Switch to Claude for fast answers (see below).

## 1. Push the code to GitHub

The VM clones the repository. A private repository is fine. You'll need a
[fine-grained personal access token](https://github.com/settings/tokens?type=beta)
with read access to it, or a deploy key.

## 2. Create the VM

1. Sign up at [cloud.oracle.com](https://cloud.oracle.com). Pick a home region
   close to you; it can't easily be changed later.
2. Create an SSH key on your machine, if you don't have one:
   `ssh-keygen -t ed25519`
3. In the console: **Compute → Instances → Create instance**.
   - **Image**: Canonical Ubuntu 24.04.
   - **Shape**: Ampere, `VM.Standard.A1.Flex`, **2 OCPUs, 12 GB memory**.
   - **Networking**: a public subnet, with a public IPv4 address assigned.
   - **SSH keys**: paste your public key (`~/.ssh/id_ed25519.pub`).
   - **Boot volume**: set a custom size of **100 GB** (the default ~50 GB works
     but is tight with Docker images and models).
4. If you get **"Out of host capacity"**, try another availability domain, or
   try again later. Free ARM capacity is popular.
5. Note the instance's **public IP address**.

## 3. Open ports 80 and 443 in the cloud firewall

**Networking → Virtual cloud networks →** your VCN **→** the public subnet **→**
its security list **→ Add ingress rules**, twice:

| Source CIDR | Protocol | Destination port |
| ----------- | -------- | ---------------- |
| `0.0.0.0/0` | TCP      | `80`             |
| `0.0.0.0/0` | TCP      | `443`            |

(The VM has its own firewall too; the setup script opens the same ports there.)

## 4. Get a hostname (free)

HTTPS certificates need a hostname, not a bare IP.

1. Sign in at [duckdns.org](https://www.duckdns.org).
2. Create a subdomain, e.g. `my-meetings` → `my-meetings.duckdns.org`.
3. Set its IP to the VM's public IP.
4. Check: `nslookup my-meetings.duckdns.org` returns that IP.

A domain you own works the same way: add an `A` record pointing to the VM.

## 5. Set up the VM

```bash
ssh ubuntu@<public-ip>

git clone https://github.com/<you>/<repo>.git meeting-intelligence
cd meeting-intelligence
bash deploy/setup-vm.sh   # installs Docker, opens ports 80/443 in the VM firewall
exit                      # log out and back in so Docker works without sudo
```

## 6. Configure and start

```bash
ssh ubuntu@<public-ip>
cd meeting-intelligence
cp deploy/.env.example deploy/.env
nano deploy/.env
```

Fill in at least:

- `DOMAIN`: your hostname from step 4.
- `BASIC_AUTH_PASSWORD`: the password you'll share (12+ characters).
- `POSTGRES_PASSWORD`: generate one with `openssl rand -hex 24`. Set it
  **before** the first start: the database keeps its first password.

Then:

```bash
bash deploy/deploy.sh
```

The first run builds the images and downloads about 6 GB (the Ollama image
plus the models). That can take 10-20 minutes. Later runs take a minute or two.

## 7. Check it

Open `https://<your-hostname>`, sign in, then **Add meetings → Load 4 sample
meetings**. When the meetings show **Ready**, try **Ask**.

If the browser warns about the certificate, wait a minute: Caddy requests it
from Let's Encrypt on the first visit.

## Using Claude instead of the local model

Local answers on 2 cores take about a minute and miss detail on harder
questions. For the demo, Claude is faster and better. A typical question is
about 3,000 input and 200 output tokens: roughly $0.02 on `claude-opus-5-5`,
under $0.001 on `claude-haiku-5-5`.

In `deploy/.env`:

```bash
LLM_PROVIDER=anthropic
ANTHROPIC_API_KEY=sk-ant-...
# LLM_MODEL=claude-haiku-5-5   # optional: cheaper and faster
```

Then `bash deploy/deploy.sh` again. Embeddings stay local either way.

## Day to day

| Task                 | Command (in `~/meeting-intelligence`)                                                                                   |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Deploy a new version | `git pull && bash deploy/deploy.sh`                                                                                     |
| Follow the logs      | `docker compose -f compose.yaml -f deploy/compose.prod.yaml logs -f api caddy`                                          |
| Status               | `docker compose -f compose.yaml -f deploy/compose.prod.yaml ps`                                                         |
| Back up the database | `docker compose -f compose.yaml -f deploy/compose.prod.yaml exec -T db pg_dump -U mi meeting_intelligence > backup.sql` |
| Stop everything      | `docker compose -f compose.yaml -f deploy/compose.prod.yaml down` (data is kept)                                        |

## Troubleshooting

| Symptom                                     | Likely cause                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Browser can't connect at all                | Port 80/443 closed: check the security list (step 3) and that `setup-vm.sh` ran.                       |
| Certificate error that doesn't go away      | The hostname doesn't point at the VM yet (`nslookup`), or port 80 is closed (Let's Encrypt checks it). |
| `502 Bad Gateway` right after deploying     | The API is still starting (migrations, model download). Check `ps` and wait for `healthy`.             |
| Meetings stay "Indexing"                    | Ollama is still downloading models: `docker compose ... logs ollama-pull`.                             |
| "Out of host capacity" when creating the VM | Try another availability domain or later.                                                              |
| Answers take ~1 minute                      | Expected for the local model on 2 cores; use Claude for speed.                                         |

## Security notes

- Everyone shares one login. That's fine for a demo, not for real users:
  there are no accounts, and anyone with the password can upload and ask.
- Only ports 22, 80 and 443 are open. Postgres and Ollama aren't reachable
  from the internet.
- There's no rate limiting yet. With Claude enabled, keep the password private
  and set a spending limit in the Anthropic Console.
- `deploy/.env` holds secrets. It's git-ignored; keep it that way.
