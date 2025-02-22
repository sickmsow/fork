import {
  cryptoWaitReady,
} from "https://deno.land/x/polkadot@0.2.45/util-crypto/mod.ts";
import { Keyring } from "https://deno.land/x/polkadot@0.2.45/keyring/mod.ts";
import {
  stringToU8a,
  u8aToHex,
} from "https://deno.land/x/polkadot@0.2.45/util/mod.ts";
import "jsr:@std/dotenv/load";
import { KeyringPair } from "https://deno.land/x/polkadot@0.2.45/keyring/types.ts";

export class StatsCollector {
  private state = {
    isValidated: false,
    isRegistered: false,
    ipAddress: ,
  };

  pair: KeyringPair | null = null;

  base_url = "https://test-kumulus-backend.deno.dev/kumulus";
  providers_url: string = "https://test-kumulus-backend.deno.dev/kumulus/providers";
  healthstats_url: string = "https://test-kumulus-backend.deno.dev/kumulus/healthstats";

  async setupWallet() {
    await cryptoWaitReady();
    const keyring = new Keyring();
    const mnemonic = Deno.env.get("MNEMONIC");

    if (!mnemonic) {
      console.error("❌ MNEMONIC environment variable is not set.");
      return; 
    }

    this.pair = keyring.createFromUri(mnemonic);
  }
  
  async signMessage(message: string) {
    if (!this.pair) {
      await this.setupWallet();
      if (!this.pair) {
        console.error("❌ Wallet setup failed. Check MNEMONIC and try again.");
      }
    }
    return { signature: u8aToHex(this.pair.sign(stringToU8a(message))), address: this.pair.address };
  }

  async checkDockerStatus(): Promise<{
    status: string;
    runningContainers: string;
    unhealthyContainers: string;
  }> {
    try {
      // Try to list containers as a simple check
      const dockerPsCmd = new Deno.Command("docker", {
        args: ["ps", "--format", "{{.ID}}"],
        stdout: "piped",
        stderr: "piped",
      });

      const dockerPsProcess = await dockerPsCmd.output();

      if (!dockerPsProcess.success) {
        console.error(
          "Docker ps command failed:",
          new TextDecoder().decode(dockerPsProcess.stderr),
        );
        return {
          status: "not running",
          runningContainers: "0",
          unhealthyContainers: "0",
        };
      }

      const runningContainers = new TextDecoder()
        .decode(dockerPsProcess.stdout)
        .trim()
        .split("\n")
        .filter((line) => line.length > 0)
        .length
        .toString();

      // Check for unhealthy containers
      const unhealthyCmd = new Deno.Command("docker", {
        args: ["ps", "--filter", "health=unhealthy", "--format", "{{.ID}}"],
        stdout: "piped",
      });

      const unhealthyProcess = await unhealthyCmd.output();
      const unhealthyContainers = unhealthyProcess.success
        ? new TextDecoder()
          .decode(unhealthyProcess.stdout)
          .trim()
          .split("\n")
          .filter((line) => line.length > 0)
          .length
          .toString()
        : "0";

      return {
        status: "running",
        runningContainers,
        unhealthyContainers,
      };
    } catch (error) {
      console.error("Error checking Docker status:", error);
      return {
        status: "unknown",
        runningContainers: "0",
        unhealthyContainers: "0",
      };
    }
  }

  async getSystemStats() {
    const now = new Date();

    const stats = {
      cpu_usage: 0,
      memory_free: "0 MB",
      disk_free: "0 GB",
      docker_status: "unknown",
      running_containers: "0",
      unhealthy_containers: "0",
      timestamp_unix: Math.floor(now.getTime() / 1000), // Unix timestamp
      timestamp_human: now.toISOString(), // ISO 8601 formatted time
    };

    try {
      // 1️⃣ Get CPU Usage
      const cpuCmd = new Deno.Command("top", {
        args: ["-bn1"],
        stdout: "piped",
      });
      const cpuProcess = await cpuCmd.output();
      if (cpuProcess.success) {
        const output = new TextDecoder().decode(cpuProcess.stdout);
        const cpuLine = output.split("\n").find((line) =>
          line.includes("Cpu(s)")
        );
        if (cpuLine) {
          const matches = cpuLine.match(/(\d+\.\d+)/g);
          if (matches && matches.length >= 2) {
            stats.cpu_usage = parseFloat(matches[0]) + parseFloat(matches[1]);
          }
        }
      } else {
        console.error("❌ Failed to get CPU usage.");
      }

      // 2️⃣ Get Free Memory
      const memCmd = new Deno.Command("free", {
        args: ["-m"],
        stdout: "piped",
      });
      const memProcess = await memCmd.output();
      if (memProcess.success) {
        const output = new TextDecoder().decode(memProcess.stdout);
        const lines = output.split("\n");
        if (lines.length > 1) {
          const memValues = lines[1].split(/\s+/);
          if (memValues.length > 3) {
            stats.memory_free = `${memValues[3]} MB`;
          }
        }
      } else {
        console.error("❌ Failed to get memory stats.");
      }

      // 3️⃣ Get Free Disk Space
      const diskCmd = new Deno.Command("df", {
        args: ["-h", "/"],
        stdout: "piped",
      });
      const diskProcess = await diskCmd.output();
      if (diskProcess.success) {
        const output = new TextDecoder().decode(diskProcess.stdout);
        const lines = output.split("\n");
        if (lines.length > 1) {
          const diskValues = lines[1].split(/\s+/);
          if (diskValues.length > 3) {
            stats.disk_free = diskValues[3]; // Available disk space
          }
        }
      } else {
        console.error("❌ Failed to get disk space.");
      }

      // 4️⃣ Check Docker Status
      // Get Docker status
      const dockerStats = await this.checkDockerStatus();
      stats.docker_status = dockerStats.status;
      stats.running_containers = dockerStats.runningContainers;
      stats.unhealthy_containers = dockerStats.unhealthyContainers;
    } catch (error) {
      console.error("❌ Error collecting system stats:", error);
    }

    return stats;
  }

  async sendHealthCheck() {
    if (!this.healthstats_url) {
      throw new Error("Health stats URL is not set.");
    }

    const stats = await this.getSystemStats();
    const message = JSON.stringify(stats);
    const signedMessage = await this.signMessage(message);
    
    try {
      const response = await fetch(this.healthstats_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message,
          signature: signedMessage.signature,
          address: signedMessage.address,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, body: ${errorData}`,
        );
      }

      console.log("✅ Health check sent successfully");
    } catch (error) {
      console.error("❌ Error sending health check:", error);
    }
  }

  async checkProviderRegistration() {
    if (!this.pair) {
      await this.setupWallet();
    }
    if (!this.providers_url) {
      throw new Error("Providers URL is not set.");
    }

    try {
      const response = await fetch(
        `${this.providers_url}/${this.pair?.address}`,
      );
      if (!response.ok) {
        console.error(
          "❌ Provider Registration check failed:",
          response.status,
        );
        return;
      }
      const data = await response.json();
      //TODO: Check Registration on chain and query directly onchain state
      this.state.isRegistered = data.address ? true : false;
      console.log(
        `🔄 Provider registration status: ${
          this.state.isRegistered ? "validated" : "not validated"
        }`,
      );
    } catch (error) {
      console.error("❌ Error checking provider registration:", error);
    }
  }

  async checkProviderValidation() {
    try {
      const response = await fetch(
        `${this.providers_url}/${this.pair?.address}`,
      );
      if (!response.ok) {
        console.error("❌ Provider Validation check failed:", response.status);
        return;
      }
      const data = await response.json();
      this.state.isValidated = !!data.address;
      console.log(
        `🔄 Provider Validation status: ${
          this.state.isValidated ? "validated" : "not validated"
        }`,
      );
    } catch (error) {
      console.error("❌ Error checking provider validation:", error);
    }
  }

  async sendIpAddress() {
    //Retrieve provider ip address
    const ipAddress = await fetch('https://ident.me').then(res => res.text());
    this.state.ipAddress = ipAddress;

    const signedMessage = await this.signMessage(ipAddress);
    
    try {
      const response = await fetch(this.healthstats_url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ipAddress,
          signature: signedMessage.signature,
          address: signedMessage.address,
        }),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `HTTP error! status: ${response.status}, body: ${errorData}`,
        );
      }

      console.log("✅ Provider Ip Address sent successfully");
    } catch (error) {
      console.error("❌ Error sending Provider Ip Address:", error);
    }
  }

  getState() {
    return this.state;
  }

  async init() {
    await this.setupWallet();
    await this.checkProviderRegistration();
    if (this.state.isRegistered) {
      await this.sendIpAddress();
      await this.sendHealthCheck();
    }
  }
}
