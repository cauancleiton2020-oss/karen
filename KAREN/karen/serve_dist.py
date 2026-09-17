# serve_dist.py - serve the dist folder and provide mock /api/karen for local presentation
import http.server
import socketserver
import json
import os
from urllib.parse import urlparse

PORT = 3000
DIST_DIR = os.path.join(os.path.dirname(__file__), 'dist')

class Handler(http.server.SimpleHTTPRequestHandler):
    def translate_path(self, path):
        # Serve files from dist directory
        if path.startswith('/api/'):
            return http.server.SimpleHTTPRequestHandler.translate_path(self, '/')
        # Map root to index.html
        if path == '/' or path == '':
            return os.path.join(DIST_DIR, 'index.html')
        # strip leading /
        rel = path.lstrip('/')
        return os.path.join(DIST_DIR, rel)

    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET,POST,OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == '/api/karen':
            length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(length).decode('utf-8') if length else ''
            try:
                data = json.loads(body) if body else {}
            except Exception:
                data = {}
            mensagem = data.get('mensagem', '')
            # Simple canned response or echo
            if mensagem:
                resposta = f"(Simulada) Recebi: {mensagem[:120]}"
            else:
                resposta = "(Simulada) Olá, sou a Karen (modo offline)."

            payload = {'resposta': resposta}
            resp = json.dumps(payload).encode('utf-8')
            self.send_response(200)
            self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Content-Length', str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)
            return

        if parsed.path == '/api/voice':
            # return 404 to force client fallback to browser TTS
            self.send_response(404)
            self.end_headers()
            return

        # default
        self.send_response(404)
        self.end_headers()


os.chdir(DIST_DIR)
with socketserver.TCPServer(('0.0.0.0', PORT), Handler) as httpd:
    print(f"Serving dist on http://localhost:{PORT}")
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        print('Stopping server')
        httpd.server_close()
