# /// script
# dependencies = [
#     "openai-whisper",
# ]
# ///
import argparse
import json
import sys
import warnings

import whisper

# Suppress warnings
warnings.filterwarnings("ignore")


def main():
    parser = argparse.ArgumentParser(description="Transcribe audio using Whisper")
    parser.add_argument("audio_path", help="Path to audio file")
    parser.add_argument(
        "--model",
        default="tiny",
        help="Model size: tiny, base, small, medium, large-v3",
    )
    parser.add_argument(
        "--model-dir",
        default=None,
        help="Directory containing Whisper model files (.pt)",
    )
    parser.add_argument(
        "--language",
        default=None,
        help="Language code (e.g., en, es, fr) or None for auto-detect",
    )
    parser.add_argument(
        "--prompt", default=None, help="Initial prompt to guide transcription"
    )

    args = parser.parse_args()

    try:
        # Load the specified Whisper model
        print(f"Loading Whisper model: {args.model}", file=sys.stderr)

        # Set download root if model directory is specified
        if args.model_dir:
            print(f"Using model directory: {args.model_dir}", file=sys.stderr)
            model = whisper.load_model(args.model, download_root=args.model_dir)
        else:
            model = whisper.load_model(args.model)

        # Prepare transcription options
        transcribe_options = {
            "task": "transcribe",  # Use 'transcribe' for same-language, 'translate' for English translation
            "word_timestamps": True,  # Enable word-level timestamps for karaoke-style highlighting
        }

        # Set language if specified (None = auto-detect)
        if args.language and args.language.lower() != "auto":
            transcribe_options["language"] = args.language
            print(f"Using language: {args.language}", file=sys.stderr)
        else:
            transcribe_options["language"] = None
            print("Auto-detecting language", file=sys.stderr)

        # Set initial prompt if provided
        # The prompt helps Whisper understand context and expected languages
        if args.prompt:
            transcribe_options["initial_prompt"] = args.prompt
            print(f"Using prompt: {args.prompt}", file=sys.stderr)
        else:
            # Default neutral prompt for general-purpose use
            transcribe_options["initial_prompt"] = (
                "The following is a transcription of spoken audio content."
            )

        # Transcribe audio file
        print(f"Transcribing: {args.audio_path}", file=sys.stderr)
        result = model.transcribe(args.audio_path, **transcribe_options)

        # Format the output into exact segments with start, end, text, and word-level timestamps
        segments = []
        for seg in result.get("segments", []):
            segment_data = {
                "start": seg["start"],
                "end": seg["end"],
                "text": seg["text"].strip(),
            }

            # Include word-level timestamps if available (for caption highlighting)
            if "words" in seg and seg["words"]:
                segment_data["words"] = [
                    {
                        "word": w["word"],
                        "start": w["start"],
                        "end": w["end"],
                        "probability": w.get("probability", 1.0),
                    }
                    for w in seg["words"]
                ]

            segments.append(segment_data)

        # Return detected language info
        output = {
            "text": result.get("text", "").strip(),
            "segments": segments,
            "language": result.get("language", "unknown"),
        }

        print(json.dumps(output))

    except Exception as e:
        print(json.dumps({"error": str(e)}), file=sys.stderr)
        sys.exit(1)


if __name__ == "__main__":
    main()
