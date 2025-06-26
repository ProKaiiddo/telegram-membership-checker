# Telegram Membership Checker API

A simple and efficient API to check if a user is a member of a Telegram chat/channel/group using Telegram Bot API.

## 📋 Table of Contents

- [Features](#features)
- [API Endpoint](#api-endpoint)
- [Authentication](#authentication)
- [Request Methods](#request-methods)
- [Parameters](#parameters)
- [Response Format](#response-format)
- [Usage Examples](#usage-examples)
- [Error Handling](#error-handling)
- [Status Codes](#status-codes)
- [Deployment](#deployment)
- [Developer](#developer)
- [Version](#version)
- [Last Update](#last-update)

## ✨ Features

- ✅ Check user membership status in Telegram chats/channels/groups
- ✅ Detect admin/creator privileges
- ✅ Support for both GET and POST requests
- ✅ RESTful API design
- ✅ Comprehensive error handling
- ✅ JSON response format
- ✅ Easy integration with any programming language
- ✅ Deployed on Vercel for high availability
- ✅ No rate limiting (depends on Telegram Bot API limits)

## 🔗 API Endpoint

**Base URL:** `https://telegram-membership-checker.vercel.app/`

**Endpoint:** `/api/check` or `/`

## 🔐 Authentication

You need a Telegram Bot Token to use this API. Get one by:
1. Message [@BotFather](https://t.me/BotFather) on Telegram
2. Create a new bot with `/newbot`
3. Get your bot token

## 📡 Request Methods

- `GET` - Parameters in query string
- `POST` - Parameters in request body (JSON or form-data)

## 📝 Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `token` | string | ✅ | Your Telegram Bot Token |
| `user_id` | string/number | ✅ | Telegram User ID to check |
| `chat_id` | string/number | ✅ | Chat/Channel/Group ID (can be @username or numeric ID) |

## 📊 Response Format

### Success Response

```json
{
  "status": "success",
  "data": {
    "is_member": true,
    "is_admin": false,
    "user_status": "member",
    "chat_id": "@example_channel",
    "user_id": "123456789"
  }
}
```

### Error Response

```json
{
  "status": "error",
  "message": "Missing required parameters: token, user_id, or chat_id"
}
```

## 🚀 Usage Examples

### 1. GET Request (cURL)

```bash
curl "https://telegram-membership-checker.vercel.app/api/check?token=YOUR_BOT_TOKEN&user_id=123456789&chat_id=@example_channel"
```

### 2. POST Request (cURL)

```bash
curl -X POST "https://telegram-membership-checker.vercel.app/api/check" \
  -H "Content-Type: application/json" \
  -d '{
    "token": "YOUR_BOT_TOKEN",
    "user_id": "123456789",
    "chat_id": "@example_channel"
  }'
```

### 3. JavaScript (Fetch API)

```javascript
// GET Request
const response = await fetch(
  `https://telegram-membership-checker.vercel.app/api/check?token=${botToken}&user_id=${userId}&chat_id=${chatId}`
);
const data = await response.json();
console.log(data);

// POST Request
const response = await fetch('https://telegram-membership-checker.vercel.app/api/check', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    token: 'YOUR_BOT_TOKEN',
    user_id: '123456789',
    chat_id: '@example_channel'
  })
});
const data = await response.json();
console.log(data);
```

### 4. Python (requests)

```python
import requests

# GET Request
url = "https://telegram-membership-checker.vercel.app/api/check"
params = {
    "token": "YOUR_BOT_TOKEN",
    "user_id": "123456789",
    "chat_id": "@example_channel"
}
response = requests.get(url, params=params)
print(response.json())

# POST Request
data = {
    "token": "YOUR_BOT_TOKEN",
    "user_id": "123456789",
    "chat_id": "@example_channel"
}
response = requests.post(url, json=data)
print(response.json())
```

### 5. PHP

```php
<?php
// GET Request
$token = 'YOUR_BOT_TOKEN';
$userId = '123456789';
$chatId = '@example_channel';

$url = "https://telegram-membership-checker.vercel.app/api/check?token={$token}&user_id={$userId}&chat_id={$chatId}";
$response = file_get_contents($url);
$data = json_decode($response, true);
print_r($data);

// POST Request
$postData = json_encode([
    'token' => 'YOUR_BOT_TOKEN',
    'user_id' => '123456789',
    'chat_id' => '@example_channel'
]);

$context = stream_context_create([
    'http' => [
        'method' => 'POST',
        'header' => 'Content-Type: application/json',
        'content' => $postData
    ]
]);

$response = file_get_contents('https://telegram-membership-checker.vercel.app/api/check', false, $context);
$data = json_decode($response, true);
print_r($data);
?>
```

### 6. Node.js (axios)

```javascript
const axios = require('axios');

// GET Request
const getRequest = async () => {
  try {
    const response = await axios.get('https://telegram-membership-checker.vercel.app/api/check', {
      params: {
        token: 'YOUR_BOT_TOKEN',
        user_id: '123456789',
        chat_id: '@example_channel'
      }
    });
    console.log(response.data);
  } catch (error) {
    console.error(error.response.data);
  }
};

// POST Request
const postRequest = async () => {
  try {
    const response = await axios.post('https://telegram-membership-checker.vercel.app/api/check', {
      token: 'YOUR_BOT_TOKEN',
      user_id: '123456789',
      chat_id: '@example_channel'
    });
    console.log(response.data);
  } catch (error) {
    console.error(error.response.data);
  }
};
```

## 📋 Example Responses

### User is a Member

```json
{
  "status": "success",
  "data": {
    "is_member": true,
    "is_admin": false,
    "user_status": "member",
    "chat_id": "@example_channel",
    "user_id": "123456789"
  }
}
```

### User is an Administrator

```json
{
  "status": "success",
  "data": {
    "is_member": true,
    "is_admin": true,
    "user_status": "administrator",
    "chat_id": "@example_channel",
    "user_id": "123456789"
  }
}
```

### User is the Creator

```json
{
  "status": "success",
  "data": {
    "is_member": true,
    "is_admin": true,
    "user_status": "creator",
    "chat_id": "@example_channel",
    "user_id": "123456789"
  }
}
```

### User is Not a Member

```json
{
  "status": "success",
  "data": {
    "is_member": false,
    "is_admin": false,
    "user_status": "non_member",
    "chat_id": "@example_channel",
    "user_id": "123456789"
  }
}
```

## ❌ Error Handling

### Missing Parameters

```json
{
  "status": "error",
  "message": "Missing required parameters: token, user_id, or chat_id"
}
```

### Invalid Bot Token

```json
{
  "status": "error",
  "message": "Unauthorized"
}
```

### Invalid Chat ID

```json
{
  "status": "error",
  "message": "Bad Request: chat not found"
}
```

### Method Not Allowed

```json
{
  "status": "error",
  "message": "Method not allowed"
}
```

### Internal Server Error

```json
{
  "status": "error",
  "message": "Internal server error"
}
```

## 📊 Status Codes

| Status Code | Description |
|-------------|-------------|
| `200` | Success - Request processed successfully |
| `400` | Bad Request - Missing or invalid parameters |
| `405` | Method Not Allowed - Unsupported HTTP method |
| `500` | Internal Server Error - Server-side error |

## 🚀 Deployment

This API is deployed on [Vercel](https://vercel.com/) for high availability and performance.

### Local Development

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm start
   ```

### Deploy to Vercel

1. Fork this repository
2. Connect your GitHub account to Vercel
3. Import the project
4. Deploy automatically

## 👨‍💻 Developer

**Developer:** [@Kaiiddo](https://telegram.me/Kaiiddo)

Feel free to reach out for support, suggestions, or collaboration!

## 📦 Dependencies

- [Telegraf](https://telegraf.js.org/) - Modern Telegram Bot API framework
- [Micro](https://github.com/vercel/micro) - Asynchronous HTTP microservices

## 🔖 Version

**Current Version:** v1.0.0

## 📅 Last Update

**Last Updated:** December 2024

## 📄 License

MIT License - feel free to use this API in your projects!

---

**Base URL:** https://telegram-membership-checker.vercel.app/

**Developer:** [@Kaiiddo](https://telegram.me/Kaiiddo)
