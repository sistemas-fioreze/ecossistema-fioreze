import { forbidden } from "../core/errors.js";

export function requireHotelAccess(session, hotelId) {
  if (!session?.hotel_ids?.includes(hotelId)) {
    throw forbidden("Usuario sem acesso ao hotel solicitado.");
  }
}
