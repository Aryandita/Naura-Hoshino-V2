'use strict';

const test = require('node:test');
const assert = require('node:assert');

const {
    safeParseInventory,
    addOrStackItem,
    countStack,
    takeStack
} = require('./inventoryHelper');

test('safeParseInventory memulihkan array dari string JSON', () => {
    assert.deepStrictEqual(safeParseInventory('[{"id":"wood"}]'), [{ id: 'wood' }]);
    assert.deepStrictEqual(safeParseInventory('bukan json'), []);
    assert.deepStrictEqual(safeParseInventory(null), []);
    assert.deepStrictEqual(safeParseInventory({ id: 'wood' }), []);
});

test('countStack menjumlahkan amount, bukan jumlah entri', () => {
    const inv = [{ id: 'pass', amount: 3 }, { id: 'wood' }, { id: 'pass', amount: 2 }];
    assert.strictEqual(countStack(inv, 'pass'), 5);
    // Entri tanpa amount dihitung satu, sesuai perilaku addOrStackItem.
    assert.strictEqual(countStack(inv, 'wood'), 1);
    assert.strictEqual(countStack(inv, 'tidak_ada'), 0);
});

test('takeStack mengurangi tumpukan dan menghapus entri yang habis', () => {
    const inv = [{ id: 'pass', amount: 2 }, { id: 'wood', amount: 1 }];
    const afterOne = takeStack(inv, 'pass', 1);
    assert.deepStrictEqual(afterOne, [{ id: 'pass', amount: 1 }, { id: 'wood', amount: 1 }]);

    const afterAll = takeStack(inv, 'pass', 2);
    assert.deepStrictEqual(afterAll, [{ id: 'wood', amount: 1 }]);

    // Inventory asli tidak boleh berubah; mutator harus bekerja pada salinan.
    assert.deepStrictEqual(inv, [{ id: 'pass', amount: 2 }, { id: 'wood', amount: 1 }]);
});

test('takeStack mengembalikan null bila jumlahnya tidak cukup', () => {
    const inv = [{ id: 'pass', amount: 1 }];
    assert.strictEqual(takeStack(inv, 'pass', 2), null);
    assert.strictEqual(takeStack(inv, 'tidak_ada', 1), null);
});

test('takeStack bisa mengambil dari beberapa tumpukan sekaligus', () => {
    const inv = [{ id: 'pass', amount: 1 }, { id: 'pass', amount: 4 }];
    assert.deepStrictEqual(takeStack(inv, 'pass', 3), [{ id: 'pass', amount: 2 }]);
});

test('addOrStackItem menumpuk item yang sudah ada', () => {
    const inv = addOrStackItem([{ id: 'wood', amount: 1 }], { id: 'wood', name: 'Kayu', amount: 2 });
    assert.strictEqual(countStack(inv, 'wood'), 3);
    assert.strictEqual(inv.length, 1);

    const added = addOrStackItem([], { id: 'stone', name: 'Batu', amount: 1 });
    assert.strictEqual(added.length, 1);
});
