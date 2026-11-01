import sys
import os
import argparse
from gtts import gTTS

def generate_speech(text, output_file, lang="en", slow=False):
    os.makedirs(os.path.dirname(os.path.abspath(output_file)), exist_ok=True)
    tts = gTTS(text=text, lang=lang, slow=slow)
    tts.save(output_file)

def main():
    parser = argparse.ArgumentParser(description="Voice Generator for TikTok Live Wishing Well")
    parser.add_argument("text", help="Text to speak")
    parser.add_argument("output", help="Output mp3 file path")
    parser.add_argument("--voice", default="en-US-JennyNeural", help="Voice model / engine")
    parser.add_argument("--lang", default="en", help="Language code (en, vi, es, etc.)")
    parser.add_argument("--rate", default="+0%", help="Speed change")
    parser.add_argument("--pitch", default="+0Hz", help="Pitch change")

    args = parser.parse_args()
    try:
        generate_speech(args.text, args.output, lang=args.lang, slow=False)
        print(f"SUCCESS: {args.output}")
    except Exception as e:
        print(f"ERROR: {e}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()
