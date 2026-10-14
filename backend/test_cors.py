import urllib.request
import urllib.error

url = "http://localhost:8000/api/notifications/unread-count"
req = urllib.request.Request(url, headers={
    "Origin": "http://localhost:5173",
    "Authorization": "Bearer invalid_token"
})

try:
    response = urllib.request.urlopen(req)
    print("Status:", response.status)
    print("Headers:", response.headers)
except urllib.error.HTTPError as e:
    print("Status:", e.code)
    print("Headers:", e.headers)
    print("Body:", e.read().decode())
