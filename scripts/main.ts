import { world } from "@minecraft/server";
import { MessageTypeChar, PortalsManager, sendMessage, TELEPORTER_PROPERTY, TeleporterState, TeleporterUtils } from "./lost";

var pm = new PortalsManager();

world.afterEvents.worldInitialize.subscribe(_ => {
    let property = world.getDynamicProperty(TELEPORTER_PROPERTY);
    let jsonString = "[]";
    if(property === undefined || typeof(property) !== 'string') {
        pm.load(jsonString);
        return;
    }
    pm.load(property);
});

world.afterEvents.itemStartUseOn.subscribe(event => {
    if(event.block.typeId !== "ninguem3421:teleporter") {
        return;
    }
    if(event.itemStack !== undefined) {
        if(event.source.isSneaking) {
            return;
        }
        if(event.itemStack.typeId === "ninguem3421:teleporter_gem") {
            return;
        }
    }
    let teleporterState = TeleporterUtils.getBlockState(event.block);
    if(teleporterState === undefined) {
        return;
    }
    switch(teleporterState) {
        case TeleporterState.INACTIVE:
            TeleporterUtils.setBlockState(event.block, TeleporterState.ACTIVE);
            break;
        case TeleporterState.ACTIVE:
            TeleporterUtils.showLogUI(pm, event.source, event.block.dimension, event.block.location);
            break;
        case TeleporterState.LOGGED:
            if(pm.portalCount() <= 0) {
                sendMessage(event.source, MessageTypeChar.ERROR, "ninguem3421.noportalavailable.message");
                return;
            }
            TeleporterUtils.showPortalsUI(pm, event.source, event.block.dimension.id, event.block.location);
            break;
    }
});

world.beforeEvents.playerBreakBlock.subscribe(event => {
    if(event.cancel) {
        return;
    }
    if(event.block.typeId !== "ninguem3421:teleporter") {
        return;
    }
    let teleporterState = TeleporterUtils.getBlockState(event.block);
    if(teleporterState === undefined) {
        return;
    }
    if(teleporterState !== TeleporterState.LOGGED) {
        return;
    }
    let portal = pm.getByLocation(event.block.location, event.block.dimension.id);
    if(portal === undefined) {
        return;
    }
    sendMessage(event.player, MessageTypeChar.ERROR, "ninguem3421.portalremoved.message", [portal.name]);
    pm.removePortalByLocation(portal.location, portal.dimensionId);
});

world.afterEvents.itemUse.subscribe(event => {
    if(event.itemStack.typeId !== "ninguem3421:teleporter_gem") {
        return;
    }
    if(event.source.getItemCooldown('teleporter_gem') !== 0) {
        return;
    }
    if(pm.portalCount() <= 0) {
        sendMessage(event.source, MessageTypeChar.ERROR, "ninguem3421.noportalavailable.message");
        return;
    }
    TeleporterUtils.showPortalsUI(pm, event.source, event.source.dimension.id, undefined, true);
});
