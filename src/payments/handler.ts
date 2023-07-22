import {
    CancelPaymentErrorResult,
    CancelPaymentResult,
    CreatePaymentResult,
    Injector,
    LanguageCode,
    PaymentMethodHandler,
    SettlePaymentErrorResult,
    SettlePaymentResult,
    UserService,
} from '@vendure/core';
import crypto from 'crypto';

import { TalonOne } from '../api/talonone';
let userService: UserService;
export const PointsIntegration = new PaymentMethodHandler({
    code: 'points',
    description: [
        {
            languageCode: LanguageCode.en,
            value: 'Loyalty Points',
        },
    ],
    args: {},
    init(injector: Injector) {
        userService = injector.get(UserService);
    },

    /** This is called when the `addPaymentToOrder` mutation is executed */
    createPayment: async (ctx, order, amount, args, metadata): Promise<CreatePaymentResult> => {
        if (metadata.pointsToRedeem) {
            const pointsToAuthorize = metadata.pointsToRedeem;
            const talonOne = new TalonOne(userService);
            try {
                await talonOne.authorizePoints(ctx, pointsToAuthorize);
                return {
                    amount: pointsToAuthorize,
                    state: 'Authorized' as const,
                    transactionId: crypto.randomBytes(16).toString('hex'),
                    metadata: {},
                };
            } catch (error: any) {
                return {
                    amount: order.total,
                    state: 'Declined' as const,
                    metadata: {
                        errorMessage: error.message,
                    },
                };
            }
        } else {
            return {
                amount: order.total,
                state: 'Declined' as const,
                metadata: {
                    errorMessage: 'No points to redeem',
                },
            };
        }
    },

    /** This is called when the `settlePayment` mutation is executed */
    settlePayment: async (
        ctx,
        order,
        payment,
        args,
    ): Promise<SettlePaymentResult | SettlePaymentErrorResult> => {
        return { success: true };
    },

    createRefund: async (ctx, input, amount, order, payment, args, metadata) => {
        const pointsToRedeem = 0;
        const talonOne = new TalonOne(userService);
        await talonOne.redeemPoints(ctx, order, pointsToRedeem);
        return {
            state: 'Settled' as const,
            transactionId: crypto.randomBytes(16).toString('hex'),
            metadata: {},
        };
    },

    /** This is called when a payment is cancelled. */
    cancelPayment: async (
        ctx,
        order,
        payment,
        args,
    ): Promise<CancelPaymentResult | CancelPaymentErrorResult> => {
        return { success: true };
    },
});
