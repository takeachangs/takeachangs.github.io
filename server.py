# Dev server: http.server + Cache-Control: no-cache, so edited assets always revalidate.
from http.server import HTTPServer, SimpleHTTPRequestHandler


class NoCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-cache")
        super().end_headers()


if __name__ == "__main__":
    HTTPServer(("", 4173), NoCache).serve_forever()
