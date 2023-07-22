import { OnApplicationBootstrap } from '@nestjs/common';
import { Parent, Resolver, ResolveField } from '@nestjs/graphql';
import {
    EventBus,
    Ctx,
    LanguageCode,
    OrderPlacedEvent,
    PluginCommonModule,
    ProductVariant,
    RequestContext,
    VendurePlugin,
    OrderLineEvent,
    OrderService,
    Payment,
    PaymentService,
    Type,
} from '@vendure/core';
import { gql } from 'graphql-tag';

import { TalonOne } from './api/talonone';
import { TalonOneOptions } from './classes/options';
import { PointsIntegration } from './payments/handler';

const pointsSchemaExtension = gql`
    extend type ProductVariant {
        loyaltyPoints: Float!
    }
    extend type Customer {
        loyaltyPoints: LoyaltyPoints!
    }
    type LoyaltyPoints {
        active: Float!
        pending: Float!
    }
`;

@Resolver('ProductVariant')
export class TalonOneProductResolver {
    constructor(private talonOne: TalonOne) {}
    @ResolveField()
    async loyaltyPoints(@Ctx() ctx: RequestContext, @Parent() variant: ProductVariant) {
        return await this.talonOne.getPointsForProduct(variant);
    }
}
@Resolver('Customer')
export class TalonOneCustomerResolver {
    constructor(private talonOne: TalonOne) {}
    @ResolveField()
    async loyaltyPoints(@Ctx() ctx: RequestContext) {
        return await this.talonOne.getPointsForUser(ctx);
    }
}
@VendurePlugin({
    imports: [PluginCommonModule],
    providers: [TalonOne],
    shopApiExtensions: {
        schema: pointsSchemaExtension,
        resolvers: [TalonOneProductResolver, TalonOneCustomerResolver],
    },
    compatibility: '^2.0.0',
    configuration: (config: any) => {
        config.customFields.Order.push({
            type: 'float',
            name: 'loyaltyPoints',
            readonly: true,
            label: [{ languageCode: LanguageCode.en, value: 'Loyalty Points' }],
        });
        config.paymentOptions.paymentMethodHandlers.push(PointsIntegration);
        return config;
    },
})
export class TalonOnePlugin implements OnApplicationBootstrap {
    static talonOneOptions: TalonOneOptions;
    constructor(
        private eventBus: EventBus,
        private paymentService: PaymentService,
        private orderService: OrderService,
        private talonOne: TalonOne,
    ) {}

    static init(paymentMethod: TalonOneOptions): Type<TalonOnePlugin> {
        this.talonOneOptions = paymentMethod;
        return TalonOnePlugin;
    }

    async onApplicationBootstrap() {
        const paymentMethod = TalonOnePlugin.talonOneOptions.paymentMethod;
        this.eventBus.ofType(OrderLineEvent).subscribe(async (event: OrderLineEvent) => {
            const loyaltyPoints = await this.talonOne.getPointsForOrder(event.ctx, event.order);
            await this.orderService.updateCustomFields(event.ctx, event.order.id, { loyaltyPoints });
        });
        this.eventBus.ofType(OrderPlacedEvent).subscribe(async (event: OrderPlacedEvent) => {
            const pointsPayments: Payment | undefined = event.order.payments.find(
                (payment: Payment) => payment.method === paymentMethod && payment.state === 'Authorized',
            );
            if (pointsPayments) {
                await this.talonOne.closeOrder(event.order);
                await this.paymentService.settlePayment(event.ctx, pointsPayments.id);
            }
        });
    }
}
