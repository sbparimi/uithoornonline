// Option values for a resident's request. Values are stored in the database as-is (and read by the
// lead matcher in lib/data/requests.ts); only the labels are translated (dictionaries: requestForm).
// Shared by the web request form and the mobile app's /api/mobile/meta.
export const REQUEST_CATEGORIES = ['Home improvement & renovation', 'Garden & outdoor', 'Plumber', 'Electrician & installation', 'Handyman', 'Cleaning & household', 'Transport & logistics', 'Security & alarm systems', 'Childcare', 'Care & health', 'Hair & beauty', 'Lessons & tutoring', 'Computer & IT help', 'Pets', 'Photography & video', 'Sport & fitness', 'Property services', 'Automotive', 'Family & personal', 'Events & occasions', 'Food & catering', 'Financial & administration', 'Legal advice', 'Professional services'];
export const REQUEST_TIMING = ['Today', 'This week', 'Next week', 'This month', 'Flexible'];
export const REQUEST_URGENCY = ['As soon as possible', 'Within a week', 'Within a month', 'No urgency'];
