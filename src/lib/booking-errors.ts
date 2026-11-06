// Plain words for the short error codes the database uses when it refuses
// a booking, a move or a cancellation.

export const bookingErrors: Record<string, string> = {
  slot_taken: "Someone just booked that time. Please pick another one.",
  too_soon: "That time is too soon to book online. Please pick a later time.",
  too_far: "That date is too far ahead to book yet.",
  outside_hours: "The shop isn’t open at that time. Please pick another one.",
  closed_then: "The shop is closed then. Please pick another day.",
  too_many: "You already have 3 upcoming bookings here. Please call the shop to book more.",
  service_not_found: "That service isn’t available any more. Please pick another one.",
  shop_not_found: "This shop isn’t taking bookings right now.",
  invalid_details: "Please check your name and email.",
  staff_not_found: "That person isn’t taking bookings any more. Please pick someone else, or call the shop.",
  no_staff: "This shop isn’t taking bookings right now.",
  not_found: "This booking link doesn’t work any more.",
  not_booked: "This booking is already cancelled.",
  too_late: "This booking has already started, so it can’t be changed online. Please call the shop.",
  too_close: "It’s too close to the time to change this booking online. Please call the shop.",
  not_signed_in: "Please log in first.",
  visitor_limit: "You’ve tried to book a lot of times. Please wait a while, or call the shop.",
  shop_limit: "Lots of people are booking here right now. Please try again in a few minutes.",
  other_account: "This booking is already saved to another account.",
  // Reviews
  not_yet: "You can leave a review once your visit is over.",
  cant_review: "This visit can’t be reviewed. Only visits booked online that went ahead, in the last 60 days, can.",
  locked: "Reviews can only be changed in the first 14 days.",
  own_shop: "You can’t review your own shop.",
  bad_review: "Please tap a star and keep the words under 1000 characters.",
};

export function bookingError(code: string | undefined, fallback = "Something went wrong. Please try again."): string {
  return (code && bookingErrors[code]) || fallback;
}
