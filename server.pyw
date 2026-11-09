import sys
import os
import functools
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

sys.stdout = sys.stderr = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'server.log'), 'a', buffering=1)

handler = functools.partial(SimpleHTTPRequestHandler, directory=os.path.dirname(os.path.abspath(__file__)))
ThreadingHTTPServer(('127.0.0.1', 8770), handler).serve_forever()