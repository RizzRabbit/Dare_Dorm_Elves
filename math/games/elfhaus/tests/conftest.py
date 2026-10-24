import os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, os.path.dirname(HERE))                          # games/elfhaus
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(HERE))))   # math/ (sdk root)
