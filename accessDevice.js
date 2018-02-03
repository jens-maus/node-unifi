
var accessDevice = function(device) {
    this._poemodes = ['off', 'passv24', 'auto'];
    this._dirty = [ ];

    this.constructor = function(device) {
        this._device = this._dropArray(device);
        if (!this.validate())
            throw `validation failed`;
    };

    this.getChanges = function() {
        var result = { };
        for (key in this._dirty) {
            var value = this._dirty[key]
            result[value] = this._device[value];
        }
        return result;
    }

    this._markDirty = function(field) {
        if (this._dirty.indexOf(field) === -1) {
            this._dirty.push(field);
        }
    };

    this.setPoe = function(port, mode) {
        var port_overrides = this._device.port_overrides;
        var port_table = this._device.port_table;
        if (this._poemodes.indexOf(mode) === -1) {
            throw `${mode} is not a valid POE mode`;
        }
        if (!(port-1 in this._device.port_table)) {
            throw `port '${port}' does not exist on this switch`;
        }
        if (this._device.port_table[port-1].port_poe === false) {
            throw `port '${port}' does not support poe`;
        }

        this._markDirty('port_overrides');

        for (var key in port_overrides) {
            if (port_overrides[key].port_idx === port) {
                this._device.port_overrides[key].poe_mode = mode
                return;
            }
        }
        // Port override must not exist yet, let's go ahead and make one.
        this._device.port_overrides.push(
            {
                port_idx: port,
                portconf_id: port_table[port-1].portconf_id,
                poe_mode: mode
            }
        );
    };

    this.validate = function() {
        if (this._device === Object(this._device)) {
            if (this._device.type === "usw") {
                return true;
            }
        }
        return false;
    }

    this._dropArray = function(obj) {
        // We only ever expect to receive our device within an array containing just our object or another nested array
        // So let's just strip off the arrays to get the object
        if (Array.isArray(obj))
            return this._dropArray(obj[0]);
        else
            return obj;
    };

    this.constructor(device);
}

module.exports = accessDevice;
