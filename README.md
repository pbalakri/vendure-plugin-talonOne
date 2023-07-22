# Vendure Talon.One plugin

# Table of Contents

1. [Installation](#installation)
2. [High Level Flow](#high-level-flow)
3. [Queries and Mutations](#queries-and-mutations)
   1. [activeCustomer query](#activecustomer-query)
   2. [addPaymentToOrder mutation](#addpaymenttoorder-mutation)

## Installation

Download the folder and place it in the packages folder of your Vendure project and add the following to your config.ts file

    `
    //Other import statements
    import { TalonOnePlugin } from '../talonone-plugin/plugin';

    export const devConfig: VendureConfig = {
    //Existing stuff
    ...
    plugins: [
    	// Other plugins
    	...
    	TalonOnePlugin.init({
    		paymentMethod: "your-points"
    	}),
    ]
    //Existing stuff
    }
    `

> Note: that 'your-points' is the same value that you will use when you create the payment method via the admin UI, so make sure they match.

Ensure you have the following keys in your environment file with the appropriate values:

`TALON_ONE_URL='https://your-endpoint.europe-west1.talon.one'`

`TALON_ONE_API_KEY='ApiKey-v1 123123123sadfasdf234213412341234'`

## High Level Flow

### PDP

1. When a PDP is requested, an API call is made to Talon.One with dry=true (so as to NOT modify the Talon.One state).
2. The response contains the points earnable for that specfic product, which is then returned in the API response within the Variants block with the "points" key.

### Adding/Removing/Updating Cart Items

1. When an order is changed, specifically when a line item is added, removed, or updated, our subscriber receives the event.
2. After receiving the event, an API call is made to Talon.One to modify its state for that particular order.
3. The response contains the points earnable per order line item as well as the entire order.
4. The points earnable for the entire order is stored in the Order's custom field "loyalty_points".

### Order Placed

When the order is placed, the Talon.One session is closed and the customer's points are deducted from their account. The Loyalty Points payment method is then automatically updated to Settled.

> Points Refund has not been implemented yet.

## Queries and Mutations

#### activeCustomer query

The Customer response of activeCustomer query should now provide the loyalty points balances

```
	query Customer {
		activeCustomer {
			loyaltyPoints {
        		active
		        pending
    		}
		}
	}
```

#### addPaymentToOrder mutation

The addPaymentToOrder mutation should include the pointsToRedeem field in the metadata indicating the number of points that the customer wishes to redeem. When the customer attempts to redeem points, a TalonOne API call is made to ensure that the customer has enough points to cover the value of the pointsToRedeem field. The state of the payment is Authorized to allow the customer to cover the rest of the order with a different payment method.

```
	mutation addPaymentToOrder {
		addPaymentToOrder(
			input: {
				method : "amal-points",
				metadata : {
					pointsToRedeem: 10
				}
			}
		)
		{
			__typename
			...on OrderPaymentStateError {
				 errorCode
				 message
			}
		}
	}

```
