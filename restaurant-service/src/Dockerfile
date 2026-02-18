# Use a lightweight web server
FROM nginx:alpine

# Remove default nginx website
RUN rm -rf /usr/share/nginx/html/*

# Copy static assets
COPY . /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# The Nginx image will automatically start the server