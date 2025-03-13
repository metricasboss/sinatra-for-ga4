# Sinatra for Google Analytics 4 - Métricas Boss

## Overview
The "Sinatra for Google Analytics 4" custom tag template was developed by Métricas Boss to replicate Google Analytics 4 events for consumption via a webhook. This template allows users to forward GA4 events to a designated server endpoint, enabling further event processing and integration with external systems.

![template](https://imagens.metricasboss.com.br/image_7fe387523b.png)

## Features
- **Event Replication:** Captures GA4 events using the GTM `addEventCallback` API and replicates them to a specified webhook endpoint.
- **Customizable Endpoint:** Users can configure the destination server URL through the advanced settings (`server_container_url`). An optional `account_id` field can also be set to include additional identifier information.
- **Sandboxed Execution:** The tag runs in a sandboxed JavaScript environment to ensure security and compatibility with GTM.
- **Logging:** Debug information is logged via the `logToConsole` API for troubleshooting purposes.
- **Flexible Configuration:** Template parameters allow customization without modifying the code, ensuring ease of use and maintenance.
