import React, { useState, useCallback, useEffect } from 'react';

const DEFAULT_CONTAINER = {
  name: '',
  width: '',
  height: '',
  depth: '',
  maxWeight: '',
  corner: '0',
  openTop: ['1']
};

const DEFAULT_ITEM = {
  name: '',
  width: '',
  height: '',
  depth: '',
  count: '1',
  weight: '',
  loadBear: '100',
  type: 1,
  updown: true,
  color: '#FF0000'
};

const BinPackingUI = () => {
  const [containers, setContainers] = useState([{ ...DEFAULT_CONTAINER }]);
  const [items, setItems] = useState([{ ...DEFAULT_ITEM }]);
  const [savedContainers, setSavedContainers] = useState([]);
  const [savedItems, setSavedItems] = useState([]);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [activeTab, setActiveTab] = useState('containers');

  // Load saved data from localStorage
  useEffect(() => {
    const savedContainersData = localStorage.getItem('savedContainers');
    const savedItemsData = localStorage.getItem('savedItems');
    if (savedContainersData) setSavedContainers(JSON.parse(savedContainersData));
    if (savedItemsData) setSavedItems(JSON.parse(savedItemsData));
  }, []);

  const resetAll = useCallback(() => {
    setContainers([{ ...DEFAULT_CONTAINER }]);
    setItems([{ ...DEFAULT_ITEM }]);
    setError('');
    setResult(null);
    setIsLoading(false);
  }, []);

  const addContainer = useCallback(() => {
    setContainers(prev => [...prev, { ...DEFAULT_CONTAINER }]);
  }, []);

  const addItem = useCallback(() => {
    setItems(prev => [...prev, { ...DEFAULT_ITEM }]);
  }, []);

  const removeContainer = useCallback((index) => {
    setContainers(prev => prev.filter((_, i) => i !== index));
  }, []);

  const removeItem = useCallback((index) => {
    setItems(prev => prev.filter((_, i) => i !== index));
  }, []);

  const updateContainer = useCallback((index, field, value) => {
    setContainers(prev => {
      const newContainers = [...prev];
      newContainers[index] = { ...newContainers[index], [field]: value };
      return newContainers;
    });
  }, []);

  const updateItem = useCallback((index, field, value) => {
    setItems(prev => {
      const newItems = [...prev];
      newItems[index] = { ...newItems[index], [field]: value };
      return newItems;
    });
  }, []);

  // Save container template
  const saveContainer = (container) => {
    const containerToSave = { ...container, id: Date.now() };
    const newSavedContainers = [...savedContainers, containerToSave];
    setSavedContainers(newSavedContainers);
    localStorage.setItem('savedContainers', JSON.stringify(newSavedContainers));
  };

  // Save item template
  const saveItem = (item) => {
    const itemToSave = { ...item, count: '1', id: Date.now() };
    const newSavedItems = [...savedItems, itemToSave];
    setSavedItems(newSavedItems);
    localStorage.setItem('savedItems', JSON.stringify(newSavedItems));
  };

  // Remove saved template
  const removeSavedContainer = (id) => {
    const newSavedContainers = savedContainers.filter(c => c.id !== id);
    setSavedContainers(newSavedContainers);
    localStorage.setItem('savedContainers', JSON.stringify(newSavedContainers));
  };

  const removeSavedItem = (id) => {
    const newSavedItems = savedItems.filter(i => i.id !== id);
    setSavedItems(newSavedItems);
    localStorage.setItem('savedItems', JSON.stringify(newSavedItems));
  };

  // Quick add saved template
  const quickAddContainer = (savedContainer) => {
    const containerToAdd = { ...savedContainer };
    delete containerToAdd.id;
    setContainers(prev => [...prev, containerToAdd]);
  };

  const quickAddItem = (savedItem) => {
    const itemToAdd = { ...savedItem };
    delete itemToAdd.id;
    setItems(prev => [...prev, itemToAdd]);
  };

  const handleSubmit = async () => {
    try {
      setError('');
      setIsLoading(true);

      // Validate weights
      const invalidItems = items.filter(item => 
        !item.weight || parseFloat(item.weight) <= 0
      );
      
      if (invalidItems.length > 0) {
        const itemNames = invalidItems.map(item => item.name || 'Unnamed Item').join(', ');
        throw new Error(`The following items must have weight greater than 0: ${itemNames}`);
      }

      // Prepare data
      const packingData = {
        box: containers.map(container => ({
          name: container.name,
          WHD: [
            parseFloat(container.width),
            parseFloat(container.height),
            parseFloat(container.depth)
          ],
          weight: container.maxWeight ? parseFloat(container.maxWeight) : 1000000,
          openTop: container.openTop.map(Number),
          coner: parseInt(container.corner)
        })),
        item: items.flatMap(item => 
          Array(parseInt(item.count)).fill().map((_, i) => ({
            name: `${item.name}-${i+1}`,
            WHD: [
              parseFloat(item.width),
              parseFloat(item.height),
              parseFloat(item.depth)
            ],
            count: 1,
            updown: item.updown ? 1 : 0,
            type: parseInt(item.type),
            level: 0,
            loadbear: item.loadBear ? parseFloat(item.loadBear) : null,
            weight: parseFloat(item.weight) || 1,
            color: item.color
          }))
        )
      };

      const response = await fetch('http://localhost:8000/api/calculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(packingData)
      });

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.message || 'Calculation failed');
      }

      setResult(data);
    } catch (error) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  // Group items by base name for display
  const groupItems = (items) => {
    const groups = {};
    items.forEach(item => {
      const baseName = item.name.split('-')[0];
      if (!groups[baseName]) {
        groups[baseName] = {
          count: 0,
          dimensions: item.dimensions,
          volume: item.volume,
          weight: item.weight,
          firstNum: parseInt(item.name.split('-')[1]),
          lastNum: parseInt(item.name.split('-')[1])
        };
      }
      groups[baseName].count++;
      groups[baseName].lastNum = Math.max(groups[baseName].lastNum, parseInt(item.name.split('-')[1]));
    });
    return groups;
  };

  const renderInputField = ({
    label,
    value,
    onChange,
    type = 'text',
    min,
    step,
    required,
    placeholder
  }) => (
    <div>
      <label className="block text-sm font-medium mb-1">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
        placeholder={placeholder}
        min={min}
        step={step}
        required={required}
      />
    </div>
  );

  const renderSavedTemplates = () => (
    <div className="mb-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="text-lg font-semibold mb-2">Saved Containers</h3>
          <div className="space-y-2">
            {savedContainers.map(container => (
              <div key={container.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span>{container.name || 'Unnamed'} ({container.width}×{container.height}×{container.depth})</span>
                <div>
                  <button
                    onClick={() => quickAddContainer(container)}
                    className="px-2 py-1 bg-blue-500 text-white rounded mr-2"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => removeSavedContainer(container.id)}
                    className="px-2 py-1 bg-red-500 text-white rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h3 className="text-lg font-semibold mb-2">Saved Items</h3>
          <div className="space-y-2">
            {savedItems.map(item => (
              <div key={item.id} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                <span>{item.name || 'Unnamed'} ({item.width}×{item.height}×{item.depth})</span>
                <div>
                  <button
                    onClick={() => quickAddItem(item)}
                    className="px-2 py-1 bg-green-500 text-white rounded mr-2"
                  >
                    Add
                  </button>
                  <button
                    onClick={() => removeSavedItem(item.id)}
                    className="px-2 py-1 bg-red-500 text-white rounded"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  const renderContainerResults = (bin) => (
    <div className="border rounded-lg bg-white shadow-sm p-4">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-semibold">Container: {bin.bin_name}</h3>
        <span className="text-blue-600 font-semibold">
          Utilization: {bin.utilization}%
        </span>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Dimensions</p>
          <p className="text-lg font-semibold">
            {bin.dimensions.map(d => d.toFixed(1)).join(' × ')}
          </p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Total Volume</p>
          <p className="text-lg font-semibold">{bin.total_volume.toFixed(2)} m³</p>
        </div>
        <div className="bg-gray-50 p-4 rounded-lg">
          <p className="text-sm text-gray-600">Used Volume</p>
          <p className="text-lg font-semibold">{bin.used_volume.toFixed(2)} m³</p>
        </div>
      </div>

      <div className="bg-gray-50 p-4 rounded-lg">
        <h4 className="font-semibold mb-2">Packed Items Summary:</h4>
        {Object.entries(groupItems(bin.items)).map(([baseName, info]) => (
          <div key={baseName} className="mb-2">
            {`${baseName}-${info.firstNum} to ${baseName}-${info.lastNum} ${info.dimensions.join(' × ')} `}
            {`Total: ${info.count} items, Volume: ${(info.volume * info.count).toFixed(2)} m³ Weight: ${(info.weight * info.count).toFixed(1)} kg`}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="p-4 max-w-6xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">3D Bin Packing Calculator</h1>
        <button
          onClick={resetAll}
          className="px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 flex items-center gap-2"
        >
          <span>Reset All</span>
        </button>
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border-l-4 border-red-500 text-red-700">
          {error}
        </div>
      )}

      {renderSavedTemplates()}

      {/* Containers Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Containers</h2>
          <button 
            onClick={addContainer}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Add Container
          </button>
        </div>

        <div className="grid gap-4">
          {containers.map((container, index) => (
            <div key={index} className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Container {index + 1}</h3>
                <button
                  onClick={() => removeContainer(index)}
                  className="text-red-500 hover:text-red-700"
                  disabled={containers.length === 1}
                >
                  Remove
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {renderInputField({
                  label: 'Name',
                  value: container.name,
                  onChange: (e) => updateContainer(index, 'name', e.target.value),
                  required: true,
                  placeholder: 'Container name'
                })}
                {renderInputField({
                  label: 'Width',
                  value: container.width,
                  onChange: (e) => updateContainer(index, 'width', e.target.value),
                  type: 'number',
                  min: 0.1,
                  step: 0.1,
                  required: true
                })}
                {renderInputField({
                  label: 'Height',
                  value: container.height,
                  onChange: (e) => updateContainer(index, 'height', e.target.value),
                  type: 'number',
                  min: 0.1,
                  step: 0.1,
                  required: true
                })}
                {renderInputField({
                  label: 'Depth',
                  value: container.depth,
                  onChange: (e) => updateContainer(index, 'depth', e.target.value),
                  type: 'number',
                  min: 0.1,
                  step: 0.1,
                  required: true
                })}
                {renderInputField({
                  label: 'Max Weight',
                  value: container.maxWeight,
                  onChange: (e) => updateContainer(index, 'maxWeight', e.target.value),
                  type: 'number',
                  min: 0,
                  step: 0.1
                })}
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => saveContainer(container)}
                  className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                >
                  Save Template
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Items Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Items</h2>
          <button 
            onClick={addItem}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
          >
            Add Item
          </button>
        </div>

        <div className="grid gap-4">
          {items.map((item, index) => (
            <div key={index} className="border rounded-lg p-4 bg-white shadow-sm">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-semibold">Item {index + 1}</h3>
                <button
                  onClick={() => removeItem(index)}
                  className="text-red-500 hover:text-red-700"
                  disabled={items.length === 1}
                >
                  Remove
                </button>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {renderInputField({
                  label: 'Name',
                  value: item.name,
                  onChange: (e) => updateItem(index, 'name', e.target.value),
                  required: true,
                  placeholder: 'Item name'
                })}
                {renderInputField({
                  label: 'Width',
                  value: item.width,
                  onChange: (e) => updateItem(index, 'width', e.target.value),
                  type: 'number',
                  min: 0.1,
                  step: 0.1,
                  required: true
                })}
                {renderInputField({
                  label: 'Height',
                  value: item.height,
                  onChange: (e) => updateItem(index, 'height', e.target.value),
                  type: 'number',
                  min: 0.1,
                  step: 0.1,
                  required: true
                })}
                {renderInputField({
                  label: 'Depth',
                  value: item.depth,
                  onChange: (e) => updateItem(index, 'depth', e.target.value),
                  type: 'number',
                  min: 0.1,
                  step: 0.1,
                  required: true
                })}
                {renderInputField({
                  label: 'Count',
                  value: item.count,
                  onChange: (e) => updateItem(index, 'count', e.target.value),
                  type: 'number',
                  min: 1,
                  step: 1,
                  required: true
                })}
                {renderInputField({
                  label: 'Weight',
                  value: item.weight,
                  onChange: (e) => updateItem(index, 'weight', e.target.value),
                  type: 'number',
                  min: 0,
                  step: 0.1
                })}
                {renderInputField({
                  label: 'Load Bearing',
                  value: item.loadBear,
                  onChange: (e) => updateItem(index, 'loadBear', e.target.value),
                  type: 'number',
                  min: 0,
                  step: 0.1
                })}
                <div>
                  <label className="block text-sm font-medium mb-1">Type</label>
                  <select
                    value={item.type}
                    onChange={(e) => updateItem(index, 'type', parseInt(e.target.value))}
                    className="w-full p-2 border rounded focus:ring-2 focus:ring-blue-500"
                  >
                    <option value={1}>Cube</option>
                    <option value={2}>Cylinder</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Color</label>
                  <input
                    type="color"
                    value={item.color}
                    onChange={(e) => updateItem(index, 'color', e.target.value)}
                    className="w-full p-1 border rounded h-10"
                  />
                </div>
              </div>
              <div className="flex justify-end mt-4">
                <button
                  onClick={() => saveItem(item)}
                  className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
                >
                  Save Template
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <button
        onClick={handleSubmit}
        disabled={isLoading}
        className="w-full py-3 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {isLoading ? 'Calculating...' : 'Calculate Packing'}
      </button>

      {/* Results Section */}
      {result && (
        <div className="mt-8">
          {/* Summary Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-indigo-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Containers Used</p>
              <p className="text-2xl font-bold text-indigo-600">
                {result.summary?.total_bins_used}
              </p>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Total Items</p>
              <p className="text-2xl font-bold text-blue-600">
                {result.summary?.total_items}
              </p>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Items Packed</p>
              <p className="text-2xl font-bold text-green-600">
                {result.summary?.total_packed_items}
              </p>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <p className="text-sm text-gray-600">Items Unpacked</p>
              <p className="text-2xl font-bold text-red-600">
                {result.summary?.total_unpacked_items}
              </p>
            </div>
          </div>

          {/* Tabs */}
          <div className="mb-4">
            <div className="border-b border-gray-200">
              <nav className="flex gap-4">
                <button
                  className={`py-2 px-4 border-b-2 ${
                    activeTab === 'containers'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent hover:border-gray-300'
                  }`}
                  onClick={() => setActiveTab('containers')}
                >
                  Containers
                </button>
                <button
                  className={`py-2 px-4 border-b-2 ${
                    activeTab === 'unpacked'
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent hover:border-gray-300'
                  }`}
                  onClick={() => setActiveTab('unpacked')}
                >
                  Unpacked Items
                </button>
              </nav>
            </div>
          </div>

          {/* Container Results */}
          {activeTab === 'containers' && (
            <div className="space-y-6">
              {result.bins?.map((bin, binIndex) => (
                <div key={binIndex}>
                  {renderContainerResults(bin)}
                </div>
              ))}
            </div>
          )}

          {/* Unpacked Items */}
          {activeTab === 'unpacked' && (
            <div className="border rounded-lg bg-white shadow-sm">
              <div className="border-b p-4">
                <h3 className="text-lg font-semibold text-red-600">
                  Unpacked Items ({result.unfitted_items?.length || 0})
                </h3>
              </div>
              <div className="p-4">
                {result.unfitted_items?.length > 0 ? (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    {Object.entries(groupItems(result.unfitted_items)).map(([baseName, info]) => (
                      <div key={baseName} className="mb-2">
                        {`${baseName}-${info.firstNum} to ${baseName}-${info.lastNum} ${info.dimensions.join(' × ')} `}
                        {`Total: ${info.count} items, Volume: ${(info.volume * info.count).toFixed(2)} m³ Weight: ${(info.weight * info.count).toFixed(1)} kg`}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    All items have been successfully packed!
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default BinPackingUI;