from youtube_transcript_api import YouTubeTranscriptApi
print(dir(YouTubeTranscriptApi))
try:
    print(f"list_transcripts exists: {'list_transcripts' in dir(YouTubeTranscriptApi)}")
except Exception as e:
    print(f"Error: {e}")
