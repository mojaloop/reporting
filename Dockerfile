FROM node:lts-buster-slim

RUN apt-get update \
    && apt-get install -y libdrm2 libgtk-3-0 libgbm1 libasound2 libxshmfence1 libnss3 libx11-xcb1

WORKDIR /app

# Create a non-root user
RUN useradd -m mluser

# Set environment variable for correct home directory
ENV HOME=/home/mluser

# Change ownership to the non-root user
RUN chown -R mluser:mluser /app

# Switch to non-root user
USER mluser

COPY --chown=mluser package.json package-lock.json* ./

RUN npm ci --production

COPY --chown=mluser src ./src

EXPOSE 3000
CMD ["npm", "start"]