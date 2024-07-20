import { world, Block, Dimension, Vector3, Player } from "@minecraft/server";
import { ActionFormData, ModalFormData } from "@minecraft/server-ui";

export const TELEPORTER_STATE: string = "ninguem3421:teleporter_state";
export const TELEPORTER_PROPERTY: string = "ninguem3421:portals";

export enum TeleporterState {
    INACTIVE = 'inactive',
    ACTIVE = 'active',
    LOGGED = 'logged'
}

export enum AddPortalAction {
    SUCCESS,
    EMPTY_NAME,
    HAS_NAME
}

export interface Portal {
    name: string;
    dimensionId: string;
    location: Vector3;
}

export enum MessageTypeChar {
    ERROR = 'c',
    NORMAL = 'a'
}

export function sendMessage(player: Player, colorChar: MessageTypeChar, translateMessage: string, withArgs: Array<string> = []) {
    player.sendMessage([
        { text: `§l§${colorChar}[!]§r §${colorChar[0]}` },
        { translate: translateMessage, with: withArgs.map(str => `${str}§r§${colorChar[0]}`) },
        { text: "§r" }
    ]);
}

function isLocationsEquals(loc1: Vector3, loc2: Vector3): boolean {
    if(
        Math.trunc(loc1.x) !== Math.trunc(loc2.x) ||
        Math.trunc(loc1.y) !== Math.trunc(loc2.y) ||
        Math.trunc(loc1.z) !== Math.trunc(loc2.z)
    ) {
        return false;
    }
    return true;
}

export function getDimensionName(dimensionId: string): string {
    switch(dimensionId) {
        case 'minecraft:overworld':
            return '§2§lOverworld§r';
        case 'minecraft:nether':
            return '§4§lNether§r';
        case 'minecraft:the_end':
            return '§5§lThe end§r';
        default:
            return '§cinvalid§r';
    }
}

function filterName(name: string) {
    let str = "";
    for(let i = 0; i < name.length; i++) {
        let char = name.charAt(i);
        if(char === "§") {
            i += 1;
            continue;
        }
        str += char;
    }
    return str;
}

export class TeleporterUtils {
    public static getBlockState(block: Block): string | undefined {
        let state = block.permutation.getState(TELEPORTER_STATE);
        if(typeof(state) !== 'string') {
            return undefined;
        }
        return state;
    }

    public static setBlockState(block: Block, state: TeleporterState) {
        block.setPermutation(block.permutation.withState(TELEPORTER_STATE, state));
    }

    public static showLogUI(pm: PortalsManager, player: Player, dimension: Dimension, location: Vector3) {
        pm.clearInvalidPortals();
        new ModalFormData()
            .title({ translate: "ninguem3421.addportalform.title" })
            .textField(
                { rawtext: [ { translate: "ninguem3421.portalnamefieldtext.text" }, { text: ":" } ] },
                { translate: "ninguem3421.portalnamefieldtext.text" }
            )
            .show(player).then(response => {
                if(response.canceled) {
                    return;
                }
                if(response.formValues === undefined) {
                    return;
                }
                let name = response.formValues[0];
                if(typeof(name) !== 'string') {
                    return;
                }
                let action: AddPortalAction = pm.addPortal({
                    name: name,
                    dimensionId: dimension.id,
                    location: location
                });
                switch(action) {
                    case AddPortalAction.SUCCESS:
                        let block = dimension.getBlock(location);
                        if(block === undefined || block.typeId === "minecraft:air") {
                            pm.removePortalByLocation(location, dimension.id);
                            sendMessage(player, MessageTypeChar.ERROR, "ninguem3421.addnotpossible.message");
                            return;
                        }
                        TeleporterUtils.setBlockState(block, TeleporterState.LOGGED);
                        sendMessage(player, MessageTypeChar.NORMAL, "ninguem3421.portaladdedsuccessfully.message", [name]);
                        break;
                    case AddPortalAction.EMPTY_NAME:
                        sendMessage(player, MessageTypeChar.ERROR, "ninguem3421.emptyportalname.message");
                        break;
                    case AddPortalAction.HAS_NAME:
                        sendMessage(player, MessageTypeChar.ERROR, "ninguem3421.alreadyhaveportalname.message", [name]);
                        break;
                }
                pm.clearInvalidPortals();
            });
    }

    public static showPortalsUI(pm: PortalsManager, player: Player, itemSource: boolean = false) {
        pm.clearInvalidPortals();
        let form = new ActionFormData()
            .title({ translate: "ninguem3421.showportalsform.title" });
        
        for(let index = 0; index < pm.portalCount(); index++) {
            let portal: Portal = pm.getByIndex(index);
            form.button(`${portal.name}\n${getDimensionName(portal.dimensionId)}`);
        }

        form.show(player).then(response => {
            if(response.canceled) {
                return;
            }
            if(response.selection === undefined) {
                return;
            }
            if(itemSource) {
                player.startItemCooldown('teleporter_gem', 600);
            }
            let portal = pm.getByIndex(response.selection);
            if(portal === undefined) {
                sendMessage(player, MessageTypeChar.ERROR, "ninguem3421.invalidportal.message");
                return;
            }
            let dimension = world.getDimension(portal.dimensionId);
            let block = dimension.getBlock(portal.location);
            if(block !== undefined && block.typeId === "minecraft:air") {
                pm.removePortalByLocation(portal.location, portal.dimensionId);
                sendMessage(player, MessageTypeChar.ERROR, "ninguem3421.invalidportal.message");
                return;
            }
            player.teleport({
                x: portal.location.x + 0.5,
                y: portal.location.y + 1.5,
                z: portal.location.z + 0.5
            }, {
                checkForBlocks: true,
                dimension: dimension
            });
        });
        pm.clearInvalidPortals();
    }
}

export class PortalsManager {
    private data: Array<Portal> = [];

    load(jsonString: string): boolean {
        let json = JSON.parse(jsonString);
        if(!(json instanceof Array)) {
            return false;
        }
        this.data = json;
        return true;
    }

    save() {
        world.setDynamicProperty(TELEPORTER_PROPERTY, JSON.stringify(this.data));
    }

    clearInvalidPortals() {
        this.data = this.data.filter(portal => {
            let block = world.getDimension(portal.dimensionId).getBlock(portal.location);
            return block === undefined || block.typeId !== "minecraft:air";
        });
    }

    portalCount(): number {
        return this.data.length;
    }

    getByIndex(index: number): Portal {
        return this.data[index];
    }

    getByLocation(loc: Vector3, dimensionId: string): Portal | undefined {
        return this.data.find(portal => isLocationsEquals(loc, portal.location) && portal.dimensionId === dimensionId);
    }

    addPortal(portal: Portal): AddPortalAction {
        if(filterName(portal.name).trim() === "") {
            return AddPortalAction.EMPTY_NAME;
        }
        if(this.data.find(value => filterName(value.name) == filterName(portal.name)) !== undefined) {
            return AddPortalAction.HAS_NAME;
        }
        this.data.push(portal);
        this.save();
        return AddPortalAction.SUCCESS;
    }

    removePortalByLocation(loc: Vector3, dimensionId: string): boolean {
        let newData = this.data.filter(value => !isLocationsEquals(value.location, loc) || value.dimensionId !== dimensionId);
        if(newData.length === this.portalCount()) {
            return false;
        }
        this.data = newData;
        this.save();
        return true;
    }
}