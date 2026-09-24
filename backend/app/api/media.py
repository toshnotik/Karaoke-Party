import mimetypes

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse

from app.game.errors import InvalidGameConfiguration
from app.settings import settings
from app.songs import load_songs


router = APIRouter(prefix="/media/songs", tags=["media"])


@router.get("/{song_id}", response_class=FileResponse)
def get_song_media(song_id: str) -> FileResponse:
    try:
        song = next(
            (song for song in load_songs(settings.song_manifest_path) if song.id == song_id),
            None,
        )
    except InvalidGameConfiguration as error:
        raise HTTPException(status_code=404, detail="Song media not found") from error
    if song is None:
        raise HTTPException(status_code=404, detail="Song media not found")

    media_root = settings.song_media_path.resolve()
    media_path = (media_root / song.audio_file).resolve()
    if media_path.parent != media_root or not media_path.is_file():
        raise HTTPException(status_code=404, detail="Song media not found")

    media_type, _ = mimetypes.guess_type(media_path.name)
    return FileResponse(media_path, media_type=media_type or "application/octet-stream")
