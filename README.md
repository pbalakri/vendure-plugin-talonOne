# Talon.One plugin

### PDP

1. When a PDP is requested, an API call is made to Talon.One with dry=true (so as to NOT modify the Talon.One state).
2. The response contains the points earnable for that specfic product, which is then returned in the API response within the Variants block with the "points" key.

### Order Changes

1. When an order is changed, specifically when a line item is added, removed, or updated, our subscriber receives the event.
2. After receiving the event, an API call is made to Talon.One to modify its state for that particular order.
3. The response contains the points earnable per order line item as well as the entire order.
4. The points earnable for the entire order is stored in the Order's custom field "loyalty_points".

### Earning Points

### Redeeming Points
