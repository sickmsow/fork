FROM ubuntu:jammy

# Install necessary packages
RUN apt-get update && apt-get install -y \
    openssh-server \
    sudo \
    && mkdir /var/run/sshd \
    && echo "✅ Installed OpenSSH Server and sudo"

# Create a non-root user for the developer
ARG USERNAME
ARG SSH_KEY

RUN useradd -m -s /bin/bash $USERNAME && \
    usermod -aG sudo $USERNAME && \
    mkdir -p /home/$USERNAME/.ssh && \
    echo "$SSH_KEY" > /home/$USERNAME/.ssh/authorized_keys && \
    chmod 700 /home/$USERNAME/.ssh && \
    chmod 600 /home/$USERNAME/.ssh/authorized_keys && \
    chown -R $USERNAME:$USERNAME /home/$USERNAME/.ssh && \
    echo "👤 User $USERNAME created and SSH key added"

# Configure SSH server
RUN sed -i 's/#PubkeyAuthentication yes/PubkeyAuthentication yes/' /etc/ssh/sshd_config && \
    sed -i 's/#PasswordAuthentication yes/PasswordAuthentication no/' /etc/ssh/sshd_config && \
    sed -i 's/#PermitRootLogin yes/PermitRootLogin no/' /etc/ssh/sshd_config && \
    echo "AllowUsers $USERNAME" >> /etc/ssh/sshd_config && \
    echo "🔒 SSH server configured for key-based authentication only"

# Configure basic resource limits in security limits
RUN echo "$USERNAME - maxlogins 1" >> /etc/security/limits.conf && \
    echo "⏳ Basic limits configured in security limits"

# Expose SSH port
EXPOSE 22

# Start SSH service
CMD ["/usr/sbin/sshd", "-D"]