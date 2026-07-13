import { all } from "../../core/database.js";

export async function listPublicRoomServiceRooms(env, hotelId) {
  return all(
    env,
    `SELECT id, code, label, room_type, sort_order
       FROM rooms
      WHERE hotel_id = ?
        AND status = 'active'
      ORDER BY sort_order, code`,
    [hotelId],
  );
}
