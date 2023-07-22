class CartItemTemplate {
    name = '';
    sku = '';
    quantity: number;
    returnedQuantity = 0;
    remainingQuantity = 1;
    price = 0;
    category = '';
    position = 0;
}

export class TalonOneSession {
    profileId: string;
    state: string;
    payment_received: boolean;
    cartItems: CartItemTemplate[];
    redeem_points: boolean;
    redeemed_loyalty_points: number;

    constructor(profileId: string) {
        this.profileId = profileId;
        this.state = 'open';
        this.payment_received = false;
        this.cartItems = [];
        this.redeem_points = false;
        this.redeemed_loyalty_points = 0;
    }
    addCartItem(name: string, sku: string, price: number, quantity: number) {
        const cartItem = new CartItemTemplate();
        cartItem.name = name;
        cartItem.sku = sku;
        cartItem.price = price / 100;
        cartItem.quantity = quantity;
        this.cartItems.push(cartItem);
    }
    redeemPoints(points: number) {
        this.redeem_points = true;
        this.redeemed_loyalty_points = points;
    }
    closeSession() {
        this.state = 'closed';
    }
    getSession() {
        if (this.state === 'closed') {
            return {
                customerSession: {
                    profileId: this.profileId,
                    state: this.state,
                },
            };
        } else {
            return {
                customerSession: {
                    profileId: this.profileId,
                    state: this.state,
                    attributes: {
                        payment_received: this.payment_received,
                        redeem_points: this.redeem_points,
                        redeemed_loyalty_points: this.redeemed_loyalty_points,
                    },
                    cartItems: this.cartItems,
                },
            };
        }
    }
}
