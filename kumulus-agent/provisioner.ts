import { Hono } from "@hono/hono";

export const app = new Hono();

interface VMRequest {
  username: string;
  sshKey: string;
  cpu: number;
  memory: string;
  disk: string;
}

async function runCommand(cmd: string, args: string[] = []): Promise<{code: number, stdout: string, stderr: string}> {
  try {
    console.log(`[LOG] Running command: ${cmd} ${args.join(' ')}`);
    
    const command = new Deno.Command(cmd, {
      args,
      stdout: "piped",
      stderr: "piped"
    });

    const { success, stdout, stderr } = await command.output();

    return {
      code: success ? 0 : 1,
      stdout: new TextDecoder().decode(stdout),
      stderr: new TextDecoder().decode(stderr)
    };
  } catch (error) {
    console.error(`[ERROR] Command execution failed: ${error.message}`);
    return {
      code: 1,
      stdout: '',
      stderr: error.message
    };
  }
}

async function findFreePort(startPort = 2222): Promise<number> {
  for (let port = startPort; port < startPort + 100; port++) {
    try {
      const listener = await Deno.listen({ port });
      listener.close();
      return port;
    } catch (_) {
      continue;
    }
  }
  throw new Error("No available ports for SSH.");
}

function generateDockerfile(username: string, sshKey: string): string {
  console.log(`[LOG] Generating Dockerfile for user: ${username}`);
  
  try {
    const encodedSshKey = btoa(sshKey);
    console.log(`[LOG] SSH Key encoded successfully`);
    
    return `
    FROM ubuntu:jammy
    
    # Install necessary packages
    RUN apt-get update && apt-get install -y openssh-server sudo
    
    # Ensure privilege separation directory exists for SSH
    RUN mkdir -p /run/sshd && chmod 0755 /run/sshd
    
    # Create a new user with sudo privileges
    RUN useradd -m -s /bin/bash ${username} && \
        usermod -aG sudo ${username} && \
        mkdir -p /home/${username}/.ssh
    
    # Set up SSH key for the user
    RUN echo "${encodedSshKey}" | base64 -d > /home/${username}/.ssh/authorized_keys && \
        chmod 700 /home/${username}/.ssh && \
        chmod 600 /home/${username}/.ssh/authorized_keys && \
        chown -R ${username}:${username} /home/${username}/.ssh
    
    # Configure SSH server
    RUN sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config && \
        sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config && \
        sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config && \
        echo "AllowUsers ${username}" >> /etc/ssh/sshd_config
    
    # Expose SSH port
    EXPOSE 22
    
    # Start SSH service
    CMD ["/usr/sbin/sshd", "-D"]
    `;
  } catch (error) {
    console.error(`[ERROR] Failed to generate Dockerfile: ${error.message}`);
    throw error;
  }
}

app.post("/create-vm", async (c) => {
  try {
    const body: VMRequest = await c.req.json();
    console.log(`[LOG] Received VM creation request for user: ${body.username}`);

    // Validate all required parameters
    const requiredParams: (keyof VMRequest)[] = ['username', 'sshKey', 'cpu', 'memory', 'disk'];
    for (const param of requiredParams) {
      if (!body[param]) {
        console.error(`[ERROR] Missing required parameter: ${param}`);
        return c.json({ error: `Missing required parameter: ${param}` }, 400);
      }
    }

    const vmId = crypto.randomUUID();
    const dockerfilePath = `/tmp/Dockerfile-${vmId}`;
    const imageName = `ubuntu-vm-${vmId}`;

    console.log(`[LOG] Generated VM ID: ${vmId}`);
    console.log(`[LOG] Dockerfile path: ${dockerfilePath}`);
    console.log(`[LOG] Image name: ${imageName}`);

    const dockerfileContent = generateDockerfile(body.username, body.sshKey);
    await Deno.writeTextFile(dockerfilePath, dockerfileContent);
    console.log(`[LOG] Dockerfile written successfully`);

    const sshPort = await findFreePort();
    console.log(`[LOG] Selected SSH port: ${sshPort}`);

    const buildResult = await runCommand('docker', [
      'build', 
      '-t', imageName, 
      '-f', dockerfilePath, 
      '.'
    ]);

    console.log(`[LOG] Build command exit code: ${buildResult.code}`);

    if (buildResult.code !== 0) {
      console.error(`[ERROR] Docker build failed`);
      console.error(`[ERROR] Build stderr: ${buildResult.stderr}`);
      console.error(`[ERROR] Build stdout: ${buildResult.stdout}`);
      
      return c.json({ 
        error: "Failed to build Docker image", 
        details: {
          stderr: buildResult.stderr,
          stdout: buildResult.stdout
        }
      }, 500);
    }

    const runResult = await runCommand('docker', [
      'run', '-d',
      `--cpus=${body.cpu}`,
      `--memory=${body.memory}`,
      `-p`, `${sshPort}:22`,
      `--name`, vmId,
      imageName
    ]);

    console.log(`[LOG] Run command exit code: ${runResult.code}`);

    if (runResult.code !== 0) {
      console.error(`[ERROR] Docker run failed`);
      console.error(`[ERROR] Run stderr: ${runResult.stderr}`);
      console.error(`[ERROR] Run stdout: ${runResult.stdout}`);
      
      return c.json({ 
        error: "Failed to start Docker container", 
        details: {
          stderr: runResult.stderr,
          stdout: runResult.stdout
        }
      }, 500);
    }

    await Deno.remove(dockerfilePath);
    console.log(`[LOG] Temporary Dockerfile removed`);

    return c.json({
      vmId,
      sshPort,
      username: body.username,
      status: "Running"
    }, 201);

  } catch (error) {
    console.error(`[FATAL ERROR] VM creation completely failed: ${error.message}`);
    console.error(`[FATAL ERROR] Error stack: ${error.stack}`);
    
    return c.json({ 
      error: "VM creation failed", 
      details: error.message 
    }, 500);
  }
});

// Stop VM by it's id vmId the we got from the create-vm endpoint   
app.post("/stop-vm", async (c) => {
  try {
    const body: { vmId: string } = await c.req.json();
    console.log(`[LOG] Received stop VM request for ID: ${body.vmId}`);

    const stopResult = await runCommand('docker', [
      'stop', body.vmId
    ]);

    console.log(`[LOG] Stop command exit code: ${stopResult.code}`);

    if (stopResult.code !== 0) {
      console.error(`[ERROR] Docker stop failed`);
      console.error(`[ERROR] Stop stderr: ${stopResult.stderr}`);
      console.error(`[ERROR] Stop stdout: ${stopResult.stdout}`);
    }

    return c.json({
      message: "VM stopped successfully"
    }, 200);
  } catch (error) {
    console.error(`[FATAL ERROR] VM stop failed: ${error.message}`);
    console.error(`[FATAL ERROR] Error stack: ${error.stack}`);
    
    return c.json({
      error: "VM stop failed",
      details: error.message
    }, 500);
  }
});

// Start VM by it's id vmId the we got from the create-vm endpoint
app.post("/start-vm", async (c) => {
  try {
    const body: { vmId: string } = await c.req.json();

    const startResult = await runCommand('docker', [
      'start', body.vmId
    ]);

    console.log(`[LOG] Start command exit code: ${startResult.code}`);
    
    if (startResult.code !== 0) {
      console.error(`[ERROR] Docker start failed`);
      console.error(`[ERROR] Start stderr: ${startResult.stderr}`);
      console.error(`[ERROR] Start stdout: ${startResult.stdout}`);
    }

    return c.json({
      message: "VM started successfully"
    }, 200);
  } catch (error) {
    console.error(`[FATAL ERROR] VM start failed: ${error.message}`);
    console.error(`[FATAL ERROR] Error stack: ${error.stack}`);

    return c.json({
      error: "VM start failed",
      details: error.message
    }, 500);
  }
});

// Get the status of the VM by it's id vmId the we got from the create-vm endpoint
app.post("/get-vm-status", async (c) => {
  try {
    const body: { vmId: string } = await c.req.json();
    console.log(`[LOG] Received get VM status request for ID: ${body.vmId}`);

    const statusResult = await runCommand('docker', [
      'ps', '-f', `id=${body.vmId}`, '-q'
    ]);

    console.log(`[LOG] Status command exit code: ${statusResult.code}`);

    if (statusResult.code !== 0) {
      console.error(`[ERROR] Docker ps failed`);
      console.error(`[ERROR] Status stderr: ${statusResult.stderr}`);
      console.error(`[ERROR] Status stdout: ${statusResult.stdout}`);
    }

    return c.json({
      status: "Running"
    }, 200);
  } catch (error) {
    console.error(`[FATAL ERROR] VM status retrieval failed: ${error.message}`);
    console.error(`[FATAL ERROR] Error stack: ${error.stack}`);
    
    return c.json({
      error: "VM status retrieval failed",
      details: error.message
    }, 500);
  }
});

// Get the logs of the VM by it's id vmId the we got from the create-vm endpoint
app.post("/get-vm-logs", async (c) => {
  try {
    const body: { vmId: string } = await c.req.json();

    const logsResult = await runCommand('docker', [
      'logs', body.vmId
    ]);

    console.log(`[LOG] Logs command exit code: ${logsResult.code}`);

    return c.json({
      logs: logsResult.stdout
    }, 200);
  } catch (error) {
    console.error(`[FATAL ERROR] VM logs retrieval failed: ${error.message}`);
    console.error(`[FATAL ERROR] Error stack: ${error.stack}`);
    
    return c.json({
      error: "VM logs retrieval failed",
      details: error.message
    }, 500);
  }
});

// Delete the VM by it's id vmId the we got from the create-vm endpoint
app.post("/delete-vm", async (c) => {
  try {
    const body: { vmId: string } = await c.req.json();
    console.log(`[LOG] Received delete VM request for ID: ${body.vmId}`);

    const deleteResult = await runCommand('docker', [
      'rm', '-f', body.vmId
    ]);

    console.log(`[LOG] Delete command exit code: ${deleteResult.code}`);

    return c.json({
      message: "VM deleted successfully"
    }, 200);
  } catch (error) {
    console.error(`[FATAL ERROR] VM deletion failed: ${error.message}`);
    console.error(`[FATAL ERROR] Error stack: ${error.stack}`);

    return c.json({
      error: "VM deletion failed",
      details: error.message
    }, 500);
  }
});
