# kumulus-provider
Kumulus Cloud provider codebase

### Provider Health check 🩺

#### Provider signature script
Deno is used here

```bash
deno run --allow-read main.ts
```
#### Automating the cron ⚙️

- Edit the system's cron job file by typing in the terminal
```bash
crontab -e
```
- Add 5 mn interval to run the script

```bash
*/5 * * * * /path/to/health_check.sh >> /var/log/health_check.log 2>&1
```

TODO: this setup  not restart resistant so it is temporary 😎
