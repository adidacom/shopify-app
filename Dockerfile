FROM node:9.8.0

# The directory where we will work from
WORKDIR /usr/src/app

# Copy the requirements
COPY package.json package.json

# Install
RUN npm install

# Copy everything from the project folder to the work dir
COPY . .

EXPOSE 8080

# Command to run when starting the service
CMD ["npm", "start"]