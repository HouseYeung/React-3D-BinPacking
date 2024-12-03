from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from py3dbp import Packer, Bin, Item, Painter
import matplotlib.pyplot as plt
from mpl_toolkits.mplot3d import Axes3D
import uvicorn
import os

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def generate_packing_report(bin_data):
    """Generate a formatted packing report for each container"""
    report = f"\nContainer: {bin_data['bin_name']}\n"
    report += f"Container dimensions: {' × '.join(map(str, bin_data['dimensions']))}\n"
    
    # Group all V-type items together
    v_items = []
    for item in bin_data['items']:
        if item['name'].startswith('V-'):
            v_items.append({
                'name': item['name'],
                'dimensions': item['dimensions'],
                'volume': item['volume'],
                'weight': item['weight']
            })
    
    if v_items:
        # All V items have same dimensions, volume, and weight
        first_v = v_items[0]
        # Extract numbers from names to find range
        numbers = [int(item['name'].split('-')[1]) for item in v_items]
        start_num = min(numbers)
        end_num = max(numbers)
        
        dimensions_str = ' × '.join(map(str, first_v['dimensions']))
        total_volume = sum(item['volume'] for item in v_items)
        total_weight = sum(item['weight'] for item in v_items)
        count = len(v_items)
        
        # Format: "V-1 to V-80 4.0 × 5.0 × 3.0 Total: 80 items, Volume: 4800.00 m³ Weight: 80.0 kg"
        report += f"V-{start_num} to V-{end_num} {dimensions_str} Total: {count} items, Volume: {total_volume:.2f} m³ Weight: {total_weight:.1f} kg\n"
    
    return report

@app.post("/api/calculate")
async def calculate_packing(data: dict):
    try:
        if not data.get('box') or not data.get('item'):
            return {
                "success": False,
                "message": "Missing container or item data"
            }

        # Initialize main packer for sequential packing
        packed_results = []
        remaining_items = []
        
        # Create initial items list
        for item in data['item']:
            count = int(item.get('count', 1))
            for i in range(count):
                weight = 1 if not item.get('weight') else float(item['weight'])
                loadbear = 100000 if not item.get('loadbear') else float(item.get('loadbear', 100000))
                item_type = 'cube' if item.get('type') == 1 else 'cylinder'
                
                new_item = Item(
                    f"{item['name']}-{i+1}",
                    'test',
                    item_type,
                    tuple(map(float, item['WHD'])),
                    weight,
                    0,
                    loadbear,
                    item.get('updown', 1),
                    item.get('color', '#FF0000')
                )
                remaining_items.append(new_item)

        # Process each container sequentially
        for box in data['box']:
            if not remaining_items:  # Stop if no more items to pack
                break
                
            # Create new packer for this container
            single_packer = Packer()
            
            # Add container
            weight = 1000000 if not box.get('weight') else float(box['weight'])
            single_packer.addBin(Bin(
                box['name'],
                tuple(map(float, box['WHD'])),
                weight,
                box.get('coner', 0),
                0
            ))
            
            # Add remaining items to this packer
            for item in remaining_items:
                single_packer.addItem(item)
            
            try:
                # Pack items
                single_packer.pack(
                    bigger_first=True,
                    distribute_items=False,
                    fix_point=True,
                    check_stable=True,
                    support_surface_ratio=0.75,
                    number_of_decimals=0
                )
                
                # Process results for this container
                for bin in single_packer.bins:
                    if not bin.items:  # Skip empty containers
                        continue
                        
                    volume = float(bin.width) * float(bin.height) * float(bin.depth)
                    volume_t = sum(float(item.width) * float(item.height) * float(item.depth) for item in bin.items)
                    
                    bin_data = {
                        "bin_name": bin.partno,
                        "dimensions": [float(bin.width), float(bin.height), float(bin.depth)],
                        "total_volume": volume,
                        "used_volume": volume_t,
                        "utilization": round(volume_t / volume * 100, 2) if volume > 0 else 0,
                        "items": [
                            {
                                "name": item.partno,
                                "position": list(item.position) if item.position else [0, 0, 0],
                                "dimensions": [float(item.width), float(item.height), float(item.depth)],
                                "volume": float(item.width) * float(item.height) * float(item.depth),
                                "weight": float(item.weight)
                            } for item in bin.items
                        ]
                    }
                    packed_results.append(bin_data)
                    
                    # Generate and print packing report
                    print(generate_packing_report(bin_data))
                    
                    # Create 3D visualization
                    painter = Painter(bin)
                    fig = painter.plotBoxAndItems(
                        title=f"Container: {bin.partno}",
                        alpha=0.6,
                        write_num=True,
                        fontsize=10
                    )
                    plt.show()
                
                # Update remaining items
                packed_items = set(item.partno for bin in single_packer.bins for item in bin.items)
                remaining_items = [item for item in remaining_items if item.partno not in packed_items]
                
            except Exception as pack_error:
                print(f"Error packing container {box['name']}: {str(pack_error)}")
                continue

        # Process final results
        total_items = len([item for item in data['item'] for _ in range(int(item.get('count', 1)))])
        total_packed_items = sum(len(bin_data["items"]) for bin_data in packed_results)
        total_volume = sum(bin_data["total_volume"] for bin_data in packed_results)
        total_used_volume = sum(bin_data["used_volume"] for bin_data in packed_results)
        
        # Create unfitted items list
        unfitted_items = [
            {
                "name": item.partno,
                "dimensions": [float(item.width), float(item.height), float(item.depth)],
                "volume": float(item.width) * float(item.height) * float(item.depth),
                "weight": float(item.weight)
            } for item in remaining_items
        ]
        
        return {
            "success": True,
            "message": "Calculation completed",
            "bins": packed_results,
            "unfitted_items": unfitted_items,
            "summary": {
                "total_bins_used": len(packed_results),
                "total_items": total_items,
                "total_packed_items": total_packed_items,
                "total_unpacked_items": len(unfitted_items),
                "total_volume": total_volume,
                "total_used_volume": total_used_volume,
                "overall_utilization": round(total_used_volume / total_volume * 100, 2) if total_volume > 0 else 0
            }
        }
        
    except Exception as e:
        import traceback
        print(traceback.format_exc())
        return {
            "success": False,
            "message": f"Packing calculation error: {str(e)}"
        }

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)