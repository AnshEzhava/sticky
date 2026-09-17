# Deploying Sticky

Sticky builds to a folder of static files, so a deploy is just "upload `out/`
and point nginx at it". [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml)
does that on every push to `main`.

## How a release works

Every deploy is staged, relabelled, then promoted with an atomic symlink swap:

```
/opt/sticky/
├── incoming/                 staging area for the upload in flight
├── releases/
│   ├── 20260917-201045/      one directory per deploy
│   └── 20260917-194412/      (the newest five are kept)
└── current -> releases/20260917-201045     <- nginx serves this
```

Nothing is deleted and re-uploaded in place, so:

- the live site is never empty or half copied during a deploy;
- a failed build or a failed upload leaves the previous release serving;
- a rollback is one symlink, no rebuild.

## Server layout

The directories already exist on `49.143.252.45`, owned by the `deploy` user,
which is the account the workflow logs in as:

```bash
sudo install -d -o deploy -g deploy -m 755 /opt/sticky /opt/sticky/releases
```

### SELinux

The host runs SELinux in **enforcing** mode and `/opt/.*` is labelled `usr_t`
by default. nginx runs in the `httpd_t` domain, which cannot read `usr_t`, so
files copied under `/opt` have to be relabelled to `httpd_sys_content_t` or
nginx answers **403** for every request.

The workflow does this for you on each release (`chcon -R`). An ordinary
unconfined user is allowed to `chcon` files it owns, so this needs no root.

If you would rather make it permanent, add one rule as root and the `chcon`
lines become redundant:

```bash
sudo semanage fcontext -a -t httpd_sys_content_t "/opt/sticky(/.*)?"
sudo restorecon -Rv /opt/sticky
```

> **Careful:** without that rule, running `restorecon` on `/opt` will relabel
> the live release back to `usr_t` and nginx will start returning 403 until the
> next deploy relabels it. The same applies to `/opt/lyfegame/client`.

## GitHub secrets

Add these three to the repository (Settings -> Secrets and variables -> Actions).
They are the same values the lyfegame pipeline already uses, so you can copy
them across:

| Secret | Value |
| --- | --- |
| `SSH_HOST` | `49.143.252.45` |
| `SSH_USER` | `deploy` |
| `SSH_PRIVATE_KEY` | the `deploy` key, the same one the lyfegame pipeline uses |

The `deploy` private key is the file `deploy-key` in the lyfegame project folder
(fingerprint `SHA256:RhXGN3w2e6/fTE6zeJs2Fyy7+HypX2IQ5NHvplicNUc`, comment
`lyfegame-ci`). It is not in `~/.ssh/` - the keys there are the `i2icore` and
unused ones. To copy it:

```bash
pbcopy < ~/Code/Personal/lyfegame/deploy-key   # paste into the SSH_PRIVATE_KEY secret
```

It has no passphrase, so GitHub Actions can use it as-is. Confirm it still works
before relying on it:

```bash
ssh -i ~/Code/Personal/lyfegame/deploy-key deploy@49.143.252.45 whoami
```

The repository has no remote yet, so the first push also needs a home:

```bash
git remote add origin git@github.com:<you>/sticky.git
git push -u origin main
```

## nginx

Drop this in `/etc/nginx/conf.d/sticky.conf` as root, replacing the subdomain
with whichever one you point at the server:

```nginx
server {
    server_name sticky.devbx.in;

    root /opt/sticky/current;
    index index.html;

    location / {
        try_files $uri $uri/ $uri.html /index.html;
    }

    # Build assets are content hashed, so they can be cached forever.
    location /_next/static/ {
        add_header Cache-Control "public, max-age=31536000, immutable";
        access_log off;
    }

    error_page 404 /404.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml image/svg+xml;
    gzip_min_length 256;

    listen 443 ssl; # managed by Certbot
    ssl_certificate /etc/letsencrypt/live/sticky.devbx.in/fullchain.pem; # managed by Certbot
    ssl_certificate_key /etc/letsencrypt/live/sticky.devbx.in/privkey.pem; # managed by Certbot
    include /etc/letsencrypt/options-ssl-nginx.conf; # managed by Certbot
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem; # managed by Certbot
}

server {
    listen 80;
    server_name sticky.devbx.in;
    return 301 https://$host$request_uri;
}
```

Then point the subdomain's DNS A record at `49.143.252.45`, and get the
certificate the same way the other sites did:

```bash
sudo certbot --nginx -d sticky.devbx.in
sudo nginx -t && sudo systemctl reload nginx
```

## Rolling back

```bash
ls -1dt /opt/sticky/releases/*/     # newest first
ln -sfn /opt/sticky/releases/<stamp> /opt/sticky/current.new
mv -T /opt/sticky/current.new /opt/sticky/current
```

The swap is atomic, so there is no window where the site is unavailable.

## Running a deploy

Push to `main`, or trigger **Deploy Sticky -> Run workflow** from the Actions
tab. To check what is live on the server:

```bash
ls -la /opt/sticky
readlink -f /opt/sticky/current
```

## Before the first deploy

`npm test` and `npm run lint` are not part of the pipeline, to keep it as short
as the existing lyfegame one. If you want them enforced, add a step after
**Install dependencies**:

```yaml
      - name: Test
        run: npm test

      - name: Lint
        run: npm run lint
```
