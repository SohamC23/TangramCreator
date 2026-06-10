import uuid
import json
from datetime import datetime, timezone
import boto3
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from auth import get_current_user
from basemodels import PresetIn

router = APIRouter()
table = boto3.resource("dynamodb").Table("TangramPresets")



def user_pk(sub: str) -> str:
    return f"USER#{sub}"


# --- Load all presets (on login) ---
@router.get("/presets")
def list_presets(sub: str = Depends(get_current_user)):
    resp = table.query(
        KeyConditionExpression=boto3.dynamodb.conditions.Key("PK").eq(user_pk(sub))
    )
    items = resp.get("Items", [])
    return [
        {
            "id": item["SK"].split("PRESET#")[1],
            "name": item["name"],
            "shapes": item["shapes"],
            "createdAt": item["createdAt"],
        }
        for item in items
    ]


# --- Create a preset ---
@router.post("/presets")
def create_preset(body: PresetIn, sub: str = Depends(get_current_user)):
    preset_id = str(uuid.uuid4())  # backend owns the ID
    table.put_item(
        Item={
            "PK": user_pk(sub),
            "SK": f"PRESET#{preset_id}",
            "name": body.name,
            "shapes": body.shapes,
            "createdAt": datetime.now(timezone.utc).isoformat(),
        }
    )
    return {"id": preset_id, "name": body.name, "shapes": body.shapes}


# --- Update a preset ---
@router.put("/presets/{preset_id}")
def update_preset(preset_id: str, body: PresetIn, sub: str = Depends(get_current_user)):
    key = {"PK": user_pk(sub), "SK": f"PRESET#{preset_id}"}
    # Ensure it exists AND belongs to this user before overwriting.
    existing = table.get_item(Key=key).get("Item")
    if not existing:
        raise HTTPException(status_code=404, detail="Preset not found")

    table.put_item(
        Item={
            **key,
            "name": body.name,
            "shapes": body.shapes,
            "createdAt": existing["createdAt"],  # preserve original timestamp
        }
    )
    return {"id": preset_id, "name": body.name, "shapes": body.shapes}


# --- Delete a preset ---
@router.delete("/presets/{preset_id}")
def delete_preset(preset_id: str, sub: str = Depends(get_current_user)):
    table.delete_item(Key={"PK": user_pk(sub), "SK": f"PRESET#{preset_id}"})
    return {"id": preset_id, "deleted": True}