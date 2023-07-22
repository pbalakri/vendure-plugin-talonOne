import { Injectable } from '@nestjs/common';
import { ProductVariant, Order, OrderLine, RequestContext, UserService } from '@vendure/core';
import crypto from 'crypto';
import https from 'https';

import { TalonOneSession } from '../classes/talonone_session';

@Injectable()
// Fetch points for a product from Talon.One
export class TalonOne {
    private returnablePoints: number;
    constructor(private userService: UserService) {
        this.returnablePoints = 0;
    }
    private updateTalonOneSession(talonOneSession: TalonOneSession, dryRequest: boolean = true) {
        return new Promise((resolve, reject) => {
            const talonOneURL = process.env.TALON_ONE_URL ? process.env.TALON_ONE_URL : '';
            const putRequest = https.request(
                `${talonOneURL}/v2/customer_sessions/${talonOneSession.profileId}${
                    dryRequest ? '?dry=true' : ''
                }`,
                {
                    method: 'PUT',
                },
                function (res) {
                    res.setEncoding('utf8');
                    let responseBody = '';
                    res.on('data', function (chunk) {
                        responseBody += chunk;
                    });
                    res.on('end', function () {
                        resolve(JSON.parse(responseBody));
                    });
                    res.on('error', function (err) {
                        reject(err);
                    });
                },
            );
            const authHeader = process.env.TALON_ONE_API_KEY ? process.env.TALON_ONE_API_KEY : '';
            putRequest.setHeader('Authorization', authHeader);
            putRequest.write(JSON.stringify(talonOneSession.getSession()));
            putRequest.end();
        });
    }

    private getTalonOneUserPoints(userID: string) {
        return new Promise((resolve, reject) => {
            const talonOneURL = process.env.TALON_ONE_URL ? process.env.TALON_ONE_URL : '';
            const getRequest = https.request(
                `${talonOneURL}/v1/loyalty_programs/10/profile/${userID}/balances`,
                {
                    method: 'GET',
                },
                function (res) {
                    res.setEncoding('utf8');
                    let responseBody = '';
                    res.on('data', function (chunk) {
                        responseBody += chunk;
                    });
                    res.on('end', function () {
                        resolve(JSON.parse(responseBody));
                    });
                    res.on('error', function (err) {
                        reject(err);
                    });
                },
            );
            const authHeader = process.env.TALON_ONE_API_KEY ? process.env.TALON_ONE_API_KEY : '';
            getRequest.setHeader('Authorization', authHeader);
            getRequest.end();
        });
    }

    async getPointsForUser(ctx: RequestContext): Promise<{ active: number; pending: number }> {
        const userID = ctx.activeUserId;
        if (!userID) {
            throw new Error(`No User Found`);
        }
        const user = await this.userService.getUserById(ctx, ctx.activeUserId);
        if (!user) {
            throw new Error(`No User Found`);
        }
        const customerPoints: any = await this.getTalonOneUserPoints(user.identifier);
        const active = customerPoints?.balance?.activePoints ? customerPoints?.balance?.activePoints : 0;
        const pending = customerPoints?.balance?.pendingPoints ? customerPoints?.balance?.pendingPoints : 0;
        return { active, pending };
    }

    async getPointsForProduct(product: ProductVariant): Promise<number> {
        const uuid = crypto.randomBytes(16).toString('hex');
        const talonOneSession = new TalonOneSession(uuid);
        talonOneSession.addCartItem(product.name, product.sku, product.price, 1);
        const talonOneResponse: any = await this.updateTalonOneSession(talonOneSession);
        const usableEffects = talonOneResponse.effects
            .filter((effect: any) => effect.effectType === 'addLoyaltyPoints')
            .map((effect: any) => effect.props.value);
        this.returnablePoints = usableEffects.reduce(
            (accumulator: number, currentValue: number) => accumulator + currentValue,
            0,
        );
        return this.returnablePoints;
    }
    async getPointsForOrder(ctx: RequestContext, order: Order): Promise<number> {
        const userID = ctx.activeUserId;
        if (!userID) {
            return this.returnablePoints;
        }
        const user = await this.userService.getUserById(ctx, ctx.activeUserId);
        if (!user) {
            return this.returnablePoints;
        }
        const talonOneSession = new TalonOneSession(user.identifier);
        order.lines.forEach((line: OrderLine) => {
            talonOneSession.addCartItem(
                line.productVariant.name,
                line.productVariant.sku,
                line.unitPrice,
                line.quantity,
            );
        });
        const talonOneResponse: any = await this.updateTalonOneSession(talonOneSession, false);
        const usableEffects = talonOneResponse.effects
            ?.filter((effect: any) => effect.effectType === 'addLoyaltyPoints')
            .map((effect: any) => effect.props.value);
        this.returnablePoints = usableEffects?.reduce(
            (accumulator: number, currentValue: number) => accumulator + currentValue,
            0,
        );
        return this.returnablePoints;
    }
    async authorizePoints(ctx: RequestContext, pointsToAuthorize: number) {
        const userID = ctx.activeUserId;
        if (!userID) {
            throw new Error(`No User Found`);
        }
        const user = await this.userService.getUserById(ctx, ctx.activeUserId);
        if (!user) {
            throw new Error(`No User Found`);
        }
        const talonOneUserPointsResponse: any = await this.getPointsForUser(ctx);
        if (pointsToAuthorize > talonOneUserPointsResponse.active) {
            throw new Error(`Not Enough Points`);
        }
    }
    async redeemPoints(ctx: RequestContext, order: Order, pointsToRedeem: number): Promise<any> {
        const userID = ctx.activeUserId;
        if (!userID) {
            throw new Error(`No User Found`);
        }
        const user = await this.userService.getUserById(ctx, ctx.activeUserId);
        if (!user) {
            throw new Error(`No User Found`);
        }
        const talonOneUserPointsResponse: any = await this.getPointsForUser(ctx);
        if (pointsToRedeem > talonOneUserPointsResponse.active) {
            throw new Error(`Not Enough Points`);
        }
        const talonOneSession = new TalonOneSession(user.identifier);
        order.lines.forEach((line: OrderLine) => {
            talonOneSession.addCartItem(
                line.productVariant.name,
                line.productVariant.sku,
                line.unitPrice,
                line.quantity,
            );
        });
        talonOneSession.redeemPoints(pointsToRedeem);
        const talonOneResponse = await this.updateTalonOneSession(talonOneSession, false);
        return talonOneResponse;
    }
    async closeOrder(order: Order): Promise<any> {
        const talonOneSession = new TalonOneSession(order.code);
        talonOneSession.closeSession();
        const talonOneResponse = await this.updateTalonOneSession(talonOneSession, false);
        return talonOneResponse;
    }
}
