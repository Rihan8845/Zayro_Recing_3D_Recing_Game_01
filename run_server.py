from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import time
import webbrowser

folder = Path(__file__).resolve().parent
class Handler(SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(folder), **kwargs)
    def log_message(self, format, *args):
        pass

server = None
for port in range(8000, 8010):
    try:
        server = ThreadingHTTPServer(('127.0.0.1', port), Handler)
        break
    except OSError:
        continue
if server is None:
    raise SystemExit('Ports 8000-8009 are busy. Close another local server and try again.')
url = f'http://127.0.0.1:{server.server_port}/'
print(f'ZAYRO RACING is running at {url}')
print('Keep this window open while playing. Press Ctrl+C to stop the server.')
threading.Timer(1, lambda: webbrowser.open(url)).start()
try:
    server.serve_forever()
except KeyboardInterrupt:
    print('\nServer stopped.')
finally:
    server.server_close()

