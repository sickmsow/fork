# Kumulus Cloud

## Components:

- Kumulus Backend: The central application that handles requests from developers and manages providers.

- kumulus-agent: The Docker container running on the provider's machine that manages resources and communicates with the backend.

- Developer Console: The user interface that developers use to interact with the platform.

- Provider Console: The user interface that providers use to interact with the platform (Initial Registration,...).

- Blockchain: Used for secure transactions and potentially for provider reputation and resource tracking, Payments

## Workflow:

### Provider Setup:

A provider go through the Kumulus Provider console and register there (email, password, address, ...).

After the provider executes the setup script that can be found on the [Kumulus Provider repo](https://github.com/kollectyve-labs/kumulus-provider) and run via curl
`curl -sL https://raw.githubusercontent.com/kollectyve-labs/kumulus-provider/develop/provider-setup/provider-setup.sh | sudo bash`


on their Ubuntu VM. This script installs Docker and configures the system to become a resource provider.

The script asks the provider for a Substrate address mnemonic. This mnemonic is the one that is tied to the wallet create via polkadot.js or talisman chrome extensions. It is used for signing and sending health statistics and receiving payment for providing compute services.

The setup script builds a kumulus-agent Docker image containing the mnemonic. The image securely manages resources and sends health statistics to the Kumulus Backend. The build process ensures the mnemonic is not stored in logs.

### Agent Running:

The kumulus-agent is a Deno application. Its 3 files are: main.ts, provisioner.ts and stats-collector.ts

The **main.ts** file starts the provisioner and the stats collector.

The **provisioner.ts** file exposes an API to create, stop and delete VMs

The **stats-collector.ts** file sends healthchecks stats to the backend.

The agent's API are exposed to the 8000 port.

### VM Request:

A developer, using the developer console, specifies the requirements for their VM (SSH public key, container size, etc.).

The frontend sends this request to the Kumulus backend.

### VM Creation:

The Kumulus backend identifies a suitable provider based on the developer's requirements and forwards the request to the selected provider's kumulus-agent.

The kumulus-agent creates and configures the VM (an Ubuntu container) according to the developer's specifications, using the provided SSH key for access. It uses Docker commands to achieve this.

### Access and Management:

Once the VM is created, the provider sends the VM details back to the backend, which then relays the information to the developer.

The developer can then access the VM via SSH.

The developer can also stop or delete the VM through the frontend, which communicates with the kumulus Backend which relays to the kumulus-agent.

### Kumulus Backend (API):

The backend has separate API endpoints for providers and developers.

Provider Endpoints (`under routes/kumulus.ts`): These handle provider registration, health statistics updates, and IP address storage. Communication is secured using signatures and API keys.

Developer Endpoints(`under routes/kumulus-dev.ts`): These handle VM creation, stopping, deletion, and other instance management functions.

## Understanding the kumulus provider code 

After checking all the kumulus provider code and the provider-setups.sh script file, let's do a local test.

This test will be done locally from a Ubuntu VM aiming to be a provider, without Kumulus backend, Console and Blockchain components.

## Setting up a Local Provider Environment

call the curl command to setup the provider environment.

This will install all the tools we cited above and clone the kumulus-provider repo in :
`/opt/kumulus-provider` so after the curl you can check with ls /opt/kumulus-provider

```sh
curl -sL https://raw.githubusercontent.com/kollectyve-labs/kumulus-provider/develop/provider-setup/provider-setup.sh | sudo bash
```
After the the setup is ok meaning you have at the end this message:

**🎉 Setup complete! The provider is now running.**
This means the setup is ok then if you run `docker ps -a` you should see the kumulus-agent running.

## Testing the VM Creation 

### Step 1: Generate an SSH Keypair on the Provider Machine

On the terminal of your Ubuntu VM (the one acting as the provider).

Generate the Keypair: Use the ssh-keygen command:

```sh
ssh-keygen -t rsa -b 2048 -N "" -f ~/.ssh/id_rsa
```
-t rsa: Specifies the RSA algorithm for key generation.

-b 2048: Sets the key size to 2048 bits (a good balance of security and performance).

-N "": Sets an empty passphrase. For testing purposes, we're skipping the passphrase. Important: In a production environment, always use a strong passphrase.

-f ~/.ssh/id_rsa: Specifies the file to save the private key (id_rsa) and the public key (id_rsa.pub) in the .ssh directory in your home directory.

View the Public Key: Display the contents of the public key file:

```sh
cat ~/.ssh/id_rsa.pub
```
Copy the entire output of this command. This is your SSH public key.

It will look something like: ssh-rsa AAAAB3NzaC1yc2EAAAADAQABAAABAQ... your_username@your_hostname


### Step 2: create the curl Command

Now, let's create the curl command to send the VM creation request to the kumulus-agent.

```sh
curl -X POST -H "Content-Type: application/json" -d \
'{
  "username": "devtest",
  "sshKey": "<REPLACE_WITH_YOUR_SSH_PUBLIC_KEY>",
  "cpu": 1,
  "memory": "1g",
  "disk": "4g"
}' \
http://localhost:8000/create-vm
```

-X POST: Specifies the HTTP method as POST.

-H "Content-Type: application/json": Sets the Content-Type header to indicate that you're sending JSON data.

-d '{...}': Specifies the JSON data to be sent in the request body.

"username": "devtest": The username for the new VM.

"sshKey": "<REPLACE_WITH_YOUR_SSH_PUBLIC_KEY>": Replace <REPLACE_WITH_YOUR_SSH_PUBLIC_KEY> with the actual content of your ~/.ssh/id_rsa.pub file that you copied in the previous step. Make sure to enclose the entire key on one line.

"cpu": 1: The number of CPU cores to allocate to the VM.

"memory": "1g": The amount of memory to allocate (1 gigabyte in this example).

"disk": "4g": The disk space to allocate (10 gigabytes in this example).

http://localhost:8000/create-vm: The URL of the kumulus-agent's /create-vm endpoint (since we are on the same environment, actually the agent is running locally).

### Step 3: Execute the curl Command

Before it is important to mention that the since the kumulus-agent is running in a docker container,
when we type the curl commant to create the vm the response are displayed in the containers log itself,
so  you might need to type:

```sh
docker logs kumulus-agent
```

Paste and Run: Carefully paste the modified curl command into your terminal and press Enter.

Examine the Response: The curl command will print the response from the kumulus-agent. 

The response should be JSON and will contain:

- vmId: The unique identifier of the newly created VM.
- sshPort: The port number on the provider machine that is forwarded to the VM's SSH port (22).
- username: The username you specified (e.g., "devtest").
- status: "Running" (if the VM was created successfully).

### Step 4: SSH into the New VM

Use the ssh command:

```sh
ssh -p <sshPort> devtest@localhost
```
Replace <sshPort> with the actual sshPort value from the curl response.

Replace devtest with the username you configured.

If you have some issues with the ssh (for example the ssh key is not found), you might need to add the -i flag to specify the private key file:

```sh
ssh -i ~/.ssh/id_rsa -p <sshPort> devtest@localhost
```
Accept the Host Key: The first time you connect to the VM, you'll be prompted to verify the host key. 

Type yes and press Enter.

You're In! You should now be logged into the newly created VM as the devtest user.