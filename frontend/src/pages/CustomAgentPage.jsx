import React, { useState, useRef, useEffect, useContext } from 'react';
import Sidebar from '../components/Sidebar';
import { ThemeContext } from '../App';
import { 
    FaPlus, FaTrash, FaArrowsAlt, FaCog, FaPlay, FaSave,
    FaRegCircle,
    FaLongArrowAltRight
} from 'react-icons/fa';
import { FiSidebar } from "react-icons/fi";
import { useNavigate } from 'react-router-dom';

const CustomAgentPage = () => {
    const [sidebarVisible, setSidebarVisible] = useState(true);
    const [nodes, setNodes] = useState([]);
    const [selectedNode, setSelectedNode] = useState(null);
    const [connections, setConnections] = useState([]);
    const [connecting, setConnecting] = useState(false);
    const [connectingFrom, setConnectingFrom] = useState(null);
    const [connectingLine, setConnectingLine] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const [hoverPort, setHoverPort] = useState(null);
    const canvasRef = useRef(null);
    const svgRef = useRef(null);
    const { theme } = useContext(ThemeContext);
    const navigate = useNavigate();

    const nodeTypes = {
        start: { name: 'Start', inputs: [], outputs: ['next'] },
        tools: { name: 'Tools', inputs: ['in'], outputs: ['next'] },
        'web-search': { name: 'Web Search', inputs: ['in'], outputs: ['success', 'error'] },
        models: { name: 'Models', inputs: ['in'], outputs: ['next'] },
        knowledgebase: { name: 'Knowledge Base', inputs: ['in'], outputs: ['next'] },
        end: { name: 'End', inputs: ['in'], outputs: [] }
    };

    const handleNavigation = (path) => {
        if (canvasRef.current) {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', endPan);
        }
        navigate(path);
    };

    const handleWheel = (e) => {
        if (canvasRef.current && canvasRef.current.contains(e.target)) {
            e.preventDefault();
            const delta = e.deltaY * -0.001;
            const newZoom = Math.max(0.2, Math.min(3, zoom + delta));
            setZoom(newZoom);
        }
    };

    const startPan = (e) => {
        if (canvasRef.current && canvasRef.current.contains(e.target)) {
            if (e.target === canvasRef.current || e.target.classList.contains('canvas-background')) {
                if (e.button === 1 || (e.button === 0 && e.altKey)) {
                    e.preventDefault();
                    setIsDragging(true);
                    setDragStart({ x: e.clientX, y: e.clientY });
                }
            }
        }
    };

    const doPan = (e) => {
        if (isDragging) {
            const dx = e.clientX - dragStart.x;
            const dy = e.clientY - dragStart.y;
            setPan({ x: pan.x + dx, y: pan.y + dy });
            setDragStart({ x: e.clientX, y: e.clientY });
        }
    };

    const endPan = (e) => {
        if (isDragging && e.type === 'mouseleave' && e.buttons === 1 && e.target === document.body) {
            return;
        }
        if (isDragging) {
            setIsDragging(false);
        }
    };

    const addNode = (type) => {
        const canvasBounds = canvasRef.current?.getBoundingClientRect();
        const centerX = canvasBounds ? (canvasBounds.width / 2 - pan.x) / zoom : 100;
        const centerY = canvasBounds ? (canvasBounds.height / 2 - pan.y) / zoom : 100;
        
        const newNode = {
            id: Date.now(),
            type,
            title: nodeTypes[type].name,
            position: { x: centerX - 125, y: centerY - 50 },
            data: { properties: {} }
        };
        setNodes([...nodes, newNode]);
        setSelectedNode(newNode);
    };

    const startConnection = (nodeId, outputName) => {
        setConnecting(true);
        setConnectingFrom({ nodeId, outputName });
    };

    const completeConnection = (toNodeId, inputName) => {
        if (connecting && connectingFrom && connectingFrom.nodeId !== toNodeId) {
            const connectionExists = connections.some(
                conn => conn.from === connectingFrom.nodeId && 
                       conn.to === toNodeId && 
                       conn.fromOutput === connectingFrom.outputName
            );

            if (!connectionExists) {
                const newConnection = {
                    id: `${connectingFrom.nodeId}-${toNodeId}-${connectingFrom.outputName}-${Date.now()}`,
                    from: connectingFrom.nodeId,
                    fromOutput: connectingFrom.outputName,
                    to: toNodeId,
                    toInput: inputName
                };
                setConnections([...connections, newConnection]);
            }
            setConnecting(false);
            setConnectingFrom(null);
            setConnectingLine(null);
        }
    };

    const updateConnectingLine = (e) => {
        if (connecting && connectingFrom && canvasRef.current) {
            const canvasRect = canvasRef.current.getBoundingClientRect();
            const fromNode = nodes.find(n => n.id === connectingFrom.nodeId);
            
            if (fromNode) {
                const outputIndex = nodeTypes[fromNode.type].outputs.indexOf(connectingFrom.outputName);
                const portOffsetX = 250 + 5;
                const portOffsetY = 30 + 15 + (outputIndex * 35);

                const fromScreenX = (fromNode.position.x + portOffsetX) * zoom + pan.x + canvasRect.left;
                const fromScreenY = (fromNode.position.y + portOffsetY) * zoom + pan.y + canvasRect.top;
                
                const toScreenX = e.clientX;
                const toScreenY = e.clientY;
                
                setConnectingLine({
                    from: { x: fromScreenX, y: fromScreenY },
                    to: { x: toScreenX, y: toScreenY },
                });
            }
        }
    };

    const handleMouseMove = (e) => {
        if (connecting) {
            updateConnectingLine(e);
        } else if (isDragging) {
            doPan(e);
        }
    };

    const handleCanvasClick = (e) => {
        if (e.target === canvasRef.current || e.target.classList.contains('canvas-background')) {
            if (connecting) {
                setConnecting(false);
                setConnectingFrom(null);
                setConnectingLine(null);
            }
            setSelectedNode(null);
        }
    };

    const startDragNode = (e, node) => {
        if (e.button === 0 && !e.altKey && !connecting) {
            e.stopPropagation();
            setSelectedNode(node);
            const startPosition = {
                x: e.clientX,
                y: e.clientY,
                nodeX: node.position.x,
                nodeY: node.position.y
            };

            const handleNodeMouseMove = (moveEvent) => {
                const dx = (moveEvent.clientX - startPosition.x) / zoom;
                const dy = (moveEvent.clientY - startPosition.y) / zoom;
                
                setNodes(prevNodes => prevNodes.map(n => 
                    n.id === node.id ? { ...n, position: { x: startPosition.nodeX + dx, y: startPosition.nodeY + dy } } : n
                ));
            };

            const handleNodeMouseUp = () => {
                document.removeEventListener('mousemove', handleNodeMouseMove);
                document.removeEventListener('mouseup', handleNodeMouseUp);
            };

            document.addEventListener('mousemove', handleNodeMouseMove);
            document.addEventListener('mouseup', handleNodeMouseUp);
        }
    };

    const deleteSelectedNode = () => {
        if (selectedNode) {
            setNodes(nodes.filter(node => node.id !== selectedNode.id));
            setConnections(connections.filter(conn => conn.from !== selectedNode.id && conn.to !== selectedNode.id));
            setSelectedNode(null);
        }
    };

    const deleteConnection = (connectionId) => {
        setConnections(connections.filter(conn => conn.id !== connectionId));
    };

    const runWorkflow = () => {
        console.log("Running workflow", { nodes, connections });
        alert("Workflow started!");
    };

    const saveWorkflow = () => {
        const workflow = { nodes, connections, created: new Date().toISOString() };
        localStorage.setItem('savedWorkflow', JSON.stringify(workflow));
        alert("Workflow saved successfully!");
    };

    const loadWorkflow = () => {
        const savedWorkflow = localStorage.getItem('savedWorkflow');
        if (savedWorkflow) {
            try {
                const workflow = JSON.parse(savedWorkflow);
                setNodes(workflow.nodes || []);
                setConnections(workflow.connections || []);
                setPan({ x: 0, y: 0 });
                setZoom(1);
                setSelectedNode(null);
            } catch (e) { console.error("Error loading workflow:", e); alert("Failed to load workflow"); }
        }
    };

    useEffect(() => {
        const canvas = canvasRef.current;
        if (canvas) {
            canvas.addEventListener('wheel', handleWheel, { passive: false });
            canvas.addEventListener('mousedown', startPan);
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', endPan);
            window.addEventListener('mouseleave', endPan);
            canvas.addEventListener('click', handleCanvasClick);

            return () => {
                canvas.removeEventListener('wheel', handleWheel);
                canvas.removeEventListener('mousedown', startPan);
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', endPan);
                window.removeEventListener('mouseleave', endPan);
                canvas.removeEventListener('click', handleCanvasClick);
            };
        }
    }, [isDragging, pan, zoom, connecting, connectingFrom]);

    useEffect(() => {
        const savedWorkflow = localStorage.getItem('savedWorkflow');
        if (savedWorkflow) {
            try {
                const workflow = JSON.parse(savedWorkflow);
                if (workflow.nodes && workflow.nodes.length > 0) {
                    const loadConfirmed = window.confirm("Load saved workflow?");
                    if (loadConfirmed) {
                        loadWorkflow();
                    }
                }
            } catch (e) { console.error("Error checking saved workflow:", e); }
        }
    }, []);

    const contentTransform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;

    const gridColor = theme === 'dark' ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)';
    const gridSpacing = 20;
    const gridPositionX = pan.x % (gridSpacing * zoom);
    const gridPositionY = pan.y % (gridSpacing * zoom);
    const gridBackgroundSize = `${gridSpacing * zoom}px ${gridSpacing * zoom}px`;
    const canvasStyle = {
        cursor: isDragging ? 'grabbing' : connecting ? 'crosshair' : 'default',
        backgroundImage: `radial-gradient(${gridColor} 1px, transparent 1px)`,
        backgroundSize: gridBackgroundSize,
        backgroundPosition: `${gridPositionX}px ${gridPositionY}px`,
        backgroundColor: theme === 'dark' ? '#1a1a1a' : '#F9FAFB',
    };

    const getConnectionPath = (fromNode, fromIndex, toNode, toIndex) => {
        const nodeWidth = 250;
        const portOffsetX = 5;
        const headerHeight = 30;
        const rowHeight = 35;
        const firstPortY = headerHeight + rowHeight / 2;

        const fromBaseX = fromNode.position.x + nodeWidth + portOffsetX;
        const fromBaseY = fromNode.position.y + firstPortY + (fromIndex * rowHeight);
        const toBaseX = toNode.position.x - portOffsetX;
        const toBaseY = toNode.position.y + firstPortY + (toIndex * rowHeight);

        const dx = Math.abs(toBaseX - fromBaseX);
        const handleOffset = Math.max(60, dx * 0.45);

        const c1x = fromBaseX + handleOffset;
        const c1y = fromBaseY;
        const c2x = toBaseX - handleOffset;
        const c2y = toBaseY;
        
        return `M ${fromBaseX} ${fromBaseY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${toBaseX} ${toBaseY}`;
    };

    const getConnectingLinePath = (line) => {
        if (!line) return '';
        const { from, to } = line;
        const dx = Math.abs(to.x - from.x);
        const handleOffset = Math.max(60, dx * 0.45);

        const c1x = from.x + handleOffset;
        const c1y = from.y;
        const c2x = to.x - handleOffset;
        const c2y = to.y;
        
        return `M ${from.x} ${from.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${to.x} ${to.y}`;
    };

    const CustomSidebar = () => (
        <Sidebar 
            isVisible={sidebarVisible} 
            onToggle={() => setSidebarVisible(!sidebarVisible)}
            onOpenSettings={() => handleNavigation('/settings')}
            onOpenHistory={() => handleNavigation('/history')}
            onNewChat={() => handleNavigation('/chat')}
        />
    );

    return (
        <div className={`flex h-screen w-full overflow-hidden ${theme === 'dark' ? 'bg-black' : 'bg-gray-100'}`}>
            <CustomSidebar />
            
            <div className={`flex-1 flex flex-col h-full transition-all duration-300 ${sidebarVisible ? 'ml-14 sm:ml-16 lg:ml-64' : 'ml-0'}`}>
                <div className={`p-2 sm:p-4 ${theme === 'dark' ? 'bg-gray-900 border-gray-800' : 'bg-white border-gray-200'} border-b flex flex-col sm:flex-row justify-between items-center z-20 shadow-sm`}>
                    <div className="flex space-x-1 sm:space-x-2 overflow-x-auto pb-1 w-full sm:w-auto scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 pl-2 sm:pl-4 lg:pl-16 mb-2 sm:mb-0">
                        {Object.keys(nodeTypes).map(type => (
                            <button
                                key={type}
                                onClick={() => addNode(type)}
                                className={`${theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700 text-gray-300 border-gray-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'} px-3 sm:px-6 py-1.5 sm:py-2 rounded-md text-xs font-medium flex items-center whitespace-nowrap transition-colors border`}
                                title={`Add ${nodeTypes[type].name} node`}
                            >
                                <FaPlus className="mr-1 sm:mr-1.5" size={10} /> 
                                {nodeTypes[type].name}
                            </button>
                        ))}
                    </div>
                    <div className="flex space-x-1 sm:space-x-1.5 flex-shrink-0">
                        <button 
                            onClick={deleteSelectedNode}
                            disabled={!selectedNode}
                            className={`p-1 sm:p-1.5 rounded-md ${
                                !selectedNode 
                                    ? `${theme === 'dark' ? 'bg-gray-800 text-gray-600' : 'bg-gray-200 text-gray-400'} cursor-not-allowed` 
                                    : `${theme === 'dark' ? 'bg-red-900 hover:bg-red-800 text-red-400' : 'bg-red-100 hover:bg-red-200 text-red-600'}`
                            } transition-colors`}
                            title="Delete selected node"
                        >
                            <FaTrash size={14} sm:size={16}/>
                        </button>
                        <button 
                            onClick={() => { setPan({ x: 0, y: 0 }); setZoom(1); }}
                            className={`p-1 sm:p-1.5 rounded-md ${theme === 'dark' ? 'bg-gray-800 hover:bg-gray-700 text-gray-400 border-gray-700' : 'bg-gray-100 hover:bg-gray-200 text-gray-600 border-gray-300'} transition-colors border`}
                            title="Center view"
                        >
                            <FaArrowsAlt size={14} sm:size={16}/>
                        </button>
                        <button 
                            onClick={saveWorkflow}
                            className={`p-1 sm:p-1.5 rounded-md ${theme === 'dark' ? 'bg-blue-900 hover:bg-blue-800 text-blue-400 border-blue-800' : 'bg-blue-100 hover:bg-blue-200 text-blue-600 border-blue-300'} transition-colors border`}
                            title="Save workflow"
                        >
                            <FaSave size={14} sm:size={16}/>
                        </button>
                        <button 
                            onClick={runWorkflow}
                            className={`p-1 sm:p-1.5 rounded-md ${theme === 'dark' ? 'bg-green-900 hover:bg-green-800 text-green-400 border-green-800' : 'bg-green-100 hover:bg-green-200 text-green-600 border-green-300'} transition-colors border`}
                            title="Run workflow"
                        >
                            <FaPlay size={14} sm:size={16}/>
                        </button>
                    </div>
                </div>
                
                {connecting && (
                    <div className="fixed top-14 sm:top-16 left-1/2 transform -translate-x-1/2 bg-blue-500 text-white px-3 py-1 rounded-md z-50 shadow-md text-xs">
                        Click input port (left) to connect, or background to cancel.
                    </div>
                )}
                
                <div ref={canvasRef} className="flex-1 relative overflow-hidden canvas-background" style={canvasStyle}>
                    <div className="absolute top-0 left-0 w-full h-full origin-top-left" style={{ transform: contentTransform }}>
                        <svg ref={svgRef} className="absolute top-0 left-0 w-full h-full pointer-events-none overflow-visible">
                            <defs>
                                <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto">
                                    <polygon points="0 0, 10 3.5, 0 7" fill={theme === 'dark' ? '#718096' : '#A0AEC0'} />
                                </marker>
                                 <marker id="arrowhead-hover" markerWidth="10" markerHeight="7" refX="8" refY="3.5" orient="auto">
                                    <polygon points="0 0, 10 3.5, 0 7" fill={theme === 'dark' ? '#A0AEC0' : '#4A5568'} />
                                </marker>
                            </defs>
                            <g>
                                {connections.map(conn => {
                                    const fromNode = nodes.find(n => n.id === conn.from);
                                    const toNode = nodes.find(n => n.id === conn.to);
                                    if (!fromNode || !toNode) return null;
                                    const fromIndex = nodeTypes[fromNode.type].outputs.indexOf(conn.fromOutput);
                                    const toIndex = nodeTypes[toNode.type].inputs.indexOf(conn.toInput);
                                    const pathD = getConnectionPath(fromNode, fromIndex, toNode, toIndex);
                                    return (
                                        <g key={conn.id} className="connection-group">
                                            <path d={pathD} stroke={theme === 'dark' ? '#718096' : '#A0AEC0'} strokeWidth={1.5 / zoom} fill="none" markerEnd="url(#arrowhead)" className="connection-path" />
                                            <path d={pathD} stroke="transparent" strokeWidth={12 / zoom} fill="none" className="connection-hitbox" style={{ cursor: 'pointer', pointerEvents: 'all' }}
                                                onClick={(e) => { e.stopPropagation(); if (window.confirm("Delete connection?")) deleteConnection(conn.id); }}
                                                onMouseEnter={(e) => { e.currentTarget.previousSibling.setAttribute('stroke', theme === 'dark' ? '#A0AEC0' : '#4A5568'); e.currentTarget.previousSibling.setAttribute('stroke-width', `${2 / zoom}`); e.currentTarget.previousSibling.setAttribute('marker-end', 'url(#arrowhead-hover)'); }}
                                                onMouseLeave={(e) => { e.currentTarget.previousSibling.setAttribute('stroke', theme === 'dark' ? '#718096' : '#A0AEC0'); e.currentTarget.previousSibling.setAttribute('stroke-width', `${1.5 / zoom}`); e.currentTarget.previousSibling.setAttribute('marker-end', 'url(#arrowhead)'); }}
                                            />
                                        </g>
                                    );
                                })}
                            </g>
                        </svg>

                        {nodes.map(node => {
                            const isSelected = selectedNode?.id === node.id;
                            const nodeConfig = nodeTypes[node.type];
                            return (
                                <div
                                    key={node.id}
                                    className={`absolute rounded-md shadow-sm flex flex-col ${theme === 'dark' ? 'bg-gray-800 border-gray-700' : 'bg-white border-gray-300'} border ${
                                        isSelected ? theme === 'dark' ? 'border-blue-600 ring-2 ring-blue-900' : 'border-blue-500 ring-2 ring-blue-200' : ''
                                    }`}
                                    style={{
                                        left: node.position.x,
                                        top: node.position.y,
                                        width: '250px',
                                        zIndex: isSelected ? 11 : 10,
                                        color: theme === 'dark' ? '#E2E8F0' : '#1F2937',
                                    }}
                                    onMouseDown={(e) => startDragNode(e, node)}
                                    onClick={(e) => { e.stopPropagation(); setSelectedNode(node); }}
                                >
                                    <div className={`p-2 px-3 ${theme === 'dark' ? 'bg-gray-900 border-gray-700' : 'bg-gray-50 border-gray-200'} border-b rounded-t-md`}>
                                        <span className={`font-medium text-sm ${theme === 'dark' ? 'text-gray-300' : 'text-gray-700'} truncate`}>{node.title}</span>
                                    </div>
                                    
                                    <div className="p-1 flex-grow relative">
                                        {node.type === 'message' && (
                                             <div className="flex items-center justify-between p-2 rounded bg-white min-h-[35px]">
                                                <span className="text-xs text-gray-500">Enter agent message</span>
                                                {nodeConfig.outputs.map((output, index) => (
                                                    <div key={`out-${index}`} className="port output-port"
                                                         style={{ top: '50%' }}
                                                         onMouseEnter={() => setHoverPort({ type: 'output', nodeId: node.id, portName: output, portIndex: index })}
                                                         onMouseLeave={() => setHoverPort(null)}
                                                         onClick={(e) => { e.stopPropagation(); startConnection(node.id, output); }}>
                                                        <FaRegCircle className={`port-icon ${hoverPort?.nodeId === node.id && hoverPort?.portName === output ? 'hovered' : ''}`} />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {node.type === 'condition' && (
                                            <div className="space-y-1 py-1">
                                                {nodeConfig.outputs.map((output, index) => (
                                                    <div key={`out-${index}`} className="flex items-center justify-between p-1.5 px-2 rounded bg-white min-h-[30px] border-t border-gray-100 first:border-t-0">
                                                        <span className="text-xs text-gray-600">{output === 'true' ? (node.data?.properties?.condition || 'Condition') : 'Else'}</span>
                                                        <div className="port output-port"
                                                             style={{ top: `${15 + index * 35}px` }}
                                                             onMouseEnter={() => setHoverPort({ type: 'output', nodeId: node.id, portName: output, portIndex: index })}
                                                             onMouseLeave={() => setHoverPort(null)}
                                                             onClick={(e) => { e.stopPropagation(); startConnection(node.id, output); }}>
                                                            <FaRegCircle className={`port-icon ${hoverPort?.nodeId === node.id && hoverPort?.portName === output ? 'hovered' : ''}`} />
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {node.type === 'web-search' && (
                                            <div className="flex items-center justify-between p-2 rounded bg-white min-h-[35px]">
                                                <span className="text-xs text-gray-500">Web search configuration</span>
                                                {nodeConfig.outputs.map((output, index) => (
                                                    <div key={`out-${index}`} className="port output-port"
                                                         style={{ top: `${15 + index * 35}px` }}
                                                         onMouseEnter={() => setHoverPort({ type: 'output', nodeId: node.id, portName: output, portIndex: index })}
                                                         onMouseLeave={() => setHoverPort(null)}
                                                         onClick={(e) => { e.stopPropagation(); startConnection(node.id, output); }}>
                                                        <FaRegCircle className={`port-icon ${hoverPort?.nodeId === node.id && hoverPort?.portName === output ? 'hovered' : ''}`} />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {node.type !== 'message' && node.type !== 'condition' && node.type !== 'web-search' && (
                                            <div className="flex items-center justify-between p-2 rounded bg-white min-h-[35px]">
                                                <span className="text-xs text-gray-500">{node.title} content placeholder</span>
                                                 {nodeConfig.outputs.map((output, index) => (
                                                    <div key={`out-${index}`} className="port output-port"
                                                         style={{ top: `${15 + index * 35}px` }}
                                                         onMouseEnter={() => setHoverPort({ type: 'output', nodeId: node.id, portName: output, portIndex: index })}
                                                         onMouseLeave={() => setHoverPort(null)}
                                                         onClick={(e) => { e.stopPropagation(); startConnection(node.id, output); }}>
                                                        <FaRegCircle className={`port-icon ${hoverPort?.nodeId === node.id && hoverPort?.portName === output ? 'hovered' : ''}`} />
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        
                                        {nodeConfig.inputs.map((input, index) => (
                                             <div key={`in-${index}`} className="port input-port"
                                                 style={{ top: `${30 + 15 + index * 35}px` }}
                                                 onMouseEnter={() => setHoverPort({ type: 'input', nodeId: node.id, portName: input, portIndex: index })}
                                                 onMouseLeave={() => setHoverPort(null)}
                                                 onClick={(e) => { e.stopPropagation(); if (connecting) completeConnection(node.id, input); }}>
                                                <FaRegCircle className={`port-icon ${connecting ? 'connectable' : ''} ${hoverPort?.nodeId === node.id && hoverPort?.portName === input ? 'hovered' : ''}`} />
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <svg className="absolute top-0 left-0 w-full h-full pointer-events-none z-10">
                        {connecting && connectingLine && (
                            <path d={getConnectingLinePath(connectingLine)} stroke={theme === 'dark' ? '#3182CE' : '#60A5FA'} strokeWidth="2" strokeDasharray="4, 4" fill="none" markerEnd="url(#arrowhead)" />
                        )}
                    </svg>
                </div>
                
                {selectedNode && (
                     <div className={`absolute right-0 top-12 bottom-0 w-64 md:w-72 ${theme === 'dark' ? 'bg-gray-900 border-gray-800 text-gray-300' : 'bg-white border-gray-200 text-gray-800'} border-l p-4 overflow-y-auto z-20 shadow-lg scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100`}>
                         <h3 className={`text-sm font-semibold mb-4 ${theme === 'dark' ? 'text-gray-300' : 'text-gray-800'}`}>{selectedNode.title} Properties</h3>
                         <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-medium mb-1 text-gray-600">Node Name</label>
                                <input type="text" className="form-input-light" value={selectedNode.title}
                                    onChange={(e) => {
                                        const newTitle = e.target.value;
                                        setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, title: newTitle } : n));
                                        setSelectedNode({ ...selectedNode, title: newTitle });
                                    }} />
                            </div>
                            {selectedNode.type === 'message' && (
                                <div>
                                    <label className="block text-xs font-medium mb-1.5 text-gray-600">Message Text</label>
                                    <textarea
                                        className="w-full p-2 rounded border border-gray-300 bg-gray-100 text-gray-700 text-sm h-24 resize-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        placeholder="Enter agent message..."
                                        value={selectedNode.data?.properties?.text || ''}
                                        onChange={(e) => {
                                            const newText = e.target.value;
                                            const updateNodeData = (prevData) => ({ ...prevData, properties: { ...prevData.properties, text: newText } });
                                            setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, data: updateNodeData(n.data) } : n));
                                            setSelectedNode({ ...selectedNode, data: updateNodeData(selectedNode.data) });
                                        }}
                                    ></textarea>
                                </div>
                            )}
                            {selectedNode.type === 'condition' && (
                                 <div>
                                    <label className="block text-xs font-medium mb-1.5 text-gray-600">Condition Logic</label>
                                    <textarea
                                        className="w-full p-2 rounded border border-gray-300 bg-gray-100 text-gray-700 text-sm h-24 resize-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        placeholder="Enter condition logic (e.g., variable == value)"
                                        value={selectedNode.data?.properties?.condition || ''}
                                        onChange={(e) => {
                                            const newCondition = e.target.value;
                                             const updateNodeData = (prevData) => ({ ...prevData, properties: { ...prevData.properties, condition: newCondition } });
                                            setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, data: updateNodeData(n.data) } : n));
                                            setSelectedNode({ ...selectedNode, data: updateNodeData(selectedNode.data) });
                                        }}
                                    ></textarea>
                                </div>
                            )}
                            {selectedNode.type === 'api' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium mb-1.5 text-gray-600">Endpoint URL</label>
                                        <input
                                            type="text"
                                            className="w-full p-2 rounded border border-gray-300 bg-gray-100 text-gray-700 text-sm focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                            placeholder="https://api.example.com/data"
                                            value={selectedNode.data?.properties?.url || ''}
                                            onChange={(e) => {
                                                const newUrl = e.target.value;
                                                const updateNodeData = (prevData) => ({ ...prevData, properties: { ...prevData.properties, url: newUrl } });
                                                setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, data: updateNodeData(n.data) } : n));
                                                setSelectedNode({ ...selectedNode, data: updateNodeData(selectedNode.data) });
                                            }}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-medium mb-1.5 text-gray-600">HTTP Method</label>
                                        <select
                                            className="w-full p-2 rounded border border-gray-300 bg-gray-100 text-gray-700 text-sm appearance-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                            value={selectedNode.data?.properties?.method || 'GET'}
                                            onChange={(e) => {
                                                 const newMethod = e.target.value;
                                                 const updateNodeData = (prevData) => ({ ...prevData, properties: { ...prevData.properties, method: newMethod } });
                                                setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, data: updateNodeData(n.data) } : n));
                                                setSelectedNode({ ...selectedNode, data: updateNodeData(selectedNode.data) });
                                            }}
                                        >
                                            <option value="GET">GET</option>
                                            <option value="POST">POST</option>
                                            <option value="PUT">PUT</option>
                                            <option value="DELETE">DELETE</option>
                                        </select>
                                    </div>
                                    <div className="text-xs text-gray-500">(Headers/Body configuration not implemented)</div>
                                </>
                            )}
                            {selectedNode.type === 'knowledgebase' && (
                                <div className="space-y-3">
                                <div>
                                    <label className="block text-xs font-medium mb-1.5 text-gray-600">Knowledge Source</label>
                                    <select
                                        className="w-full p-2 rounded border border-gray-300 bg-gray-100 text-gray-700 text-sm appearance-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        value={selectedNode.data?.properties?.source || 'documents'}
                                         onChange={(e) => {
                                             const newSource = e.target.value;
                                             const updateNodeData = (prevData) => ({ ...prevData, properties: { ...prevData.properties, source: newSource } });
                                            setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, data: updateNodeData(n.data) } : n));
                                            setSelectedNode({ ...selectedNode, data: updateNodeData(selectedNode.data) });
                                        }}
                                    >
                                        <option value="documents">Documents</option>
                                        <option value="website">Website URL</option>
                                        <option value="database">Database Table</option>
                                            <option value="file-upload">File Upload</option>
                                        </select>
                                    </div>
                                    
                                    {selectedNode.data?.properties?.source === 'file-upload' && (
                                        <div>
                                            <label className="block text-xs font-medium mb-1.5 text-gray-600">Upload File</label>
                                            <div className="flex items-center justify-center w-full">
                                                <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                                                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                                                        <svg className="w-8 h-8 mb-3 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"></path></svg>
                                                        <p className="mb-1 text-xs text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                                        <p className="text-xs text-gray-500">PDF, TXT, DOCX, CSV</p>
                                                    </div>
                                                    <input type="file" className="hidden" />
                                                </label>
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-between mt-2">
                                        <span className="text-xs font-medium text-gray-600">Mode</span>
                                        <div className="flex space-x-3">
                                            <label className="inline-flex items-center">
                                                <input
                                                    type="radio"
                                                    className="form-radio text-blue-600"
                                                    name="mode"
                                                    value="normal"
                                                    checked={selectedNode.data?.properties?.mode !== 'advanced'}
                                                    onChange={() => {
                                                        const updateNodeData = (prevData) => ({ ...prevData, properties: { ...prevData.properties, mode: 'normal' } });
                                                        setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, data: updateNodeData(n.data) } : n));
                                                        setSelectedNode({ ...selectedNode, data: updateNodeData(selectedNode.data) });
                                                    }}
                                                />
                                                <span className="ml-1 text-xs text-gray-700">Normal</span>
                                            </label>
                                            <label className="inline-flex items-center">
                                                <input
                                                    type="radio"
                                                    className="form-radio text-blue-600"
                                                    name="mode"
                                                    value="advanced"
                                                    checked={selectedNode.data?.properties?.mode === 'advanced'}
                                                    onChange={() => {
                                                        const updateNodeData = (prevData) => ({ ...prevData, properties: { ...prevData.properties, mode: 'advanced' } });
                                                        setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, data: updateNodeData(n.data) } : n));
                                                        setSelectedNode({ ...selectedNode, data: updateNodeData(selectedNode.data) });
                                                    }}
                                                />
                                                <span className="ml-1 text-xs text-gray-700">Advanced</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            )}
                            {selectedNode.type === 'web-search' && (
                                <div>
                                    <label className="block text-xs font-medium mb-1.5 text-gray-600">Search Query</label>
                                    <textarea
                                        className="w-full p-2 rounded border border-gray-300 bg-gray-100 text-gray-700 text-sm h-24 resize-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        placeholder="Enter search query or parameters..."
                                        value={selectedNode.data?.properties?.query || ''}
                                        onChange={(e) => {
                                            const newQuery = e.target.value;
                                            const updateNodeData = (prevData) => ({ ...prevData, properties: { ...prevData.properties, query: newQuery } });
                                            setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, data: updateNodeData(n.data) } : n));
                                            setSelectedNode({ ...selectedNode, data: updateNodeData(selectedNode.data) });
                                        }}
                                    ></textarea>
                                </div>
                            )}
                            {selectedNode.type === 'models' && (
                                <div>
                                    <label className="block text-xs font-medium mb-1.5 text-gray-600">Model Selection</label>
                                    <select
                                        className="w-full p-2 rounded border border-gray-300 bg-gray-100 text-gray-700 text-sm appearance-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                        value={selectedNode.data?.properties?.model || 'gpt-4'}
                                        onChange={(e) => {
                                            const newModel = e.target.value;
                                            const updateNodeData = (prevData) => ({ ...prevData, properties: { ...prevData.properties, model: newModel } });
                                            setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, data: updateNodeData(n.data) } : n));
                                            setSelectedNode({ ...selectedNode, data: updateNodeData(selectedNode.data) });
                                        }}
                                    >
                                        <option value="gpt-4">GPT-4</option>
                                        <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                                        <option value="claude-3">Claude 3</option>
                                        <option value="llama-3">Llama 3</option>
                                    </select>
                                </div>
                            )}
                            {selectedNode.type === 'tools' && (
                                <>
                                    <div>
                                        <label className="block text-xs font-medium mb-1.5 text-gray-600">Tool Type</label>
                                        <select
                                            className="w-full p-2 rounded border border-gray-300 bg-gray-100 text-gray-700 text-sm appearance-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                            value={selectedNode.data?.properties?.toolType || 'code-editor'}
                                            onChange={(e) => {
                                                const newToolType = e.target.value;
                                                const updateNodeData = (prevData) => ({ ...prevData, properties: { ...prevData.properties, toolType: newToolType } });
                                                setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, data: updateNodeData(n.data) } : n));
                                                setSelectedNode({ ...selectedNode, data: updateNodeData(selectedNode.data) });
                                            }}
                                        >
                                            <option value="code-editor">Code Editor</option>
                                            <option value="news-maker">News Maker</option>
                                            <option value="image-generation">Image Generation</option>
                                            <option value="music-generation">Music Generation</option>
                                            <option value="code-interpreter">Code Interpreter</option>
                                            <option value="data-analysis">Data Analysis</option>
                                            <option value="custom-tool">Custom Tool</option>
                                        </select>
                                    </div>
                                    <div className="mt-3">
                                        <label className="block text-xs font-medium mb-1.5 text-gray-600">Parameters</label>
                                        <textarea
                                            className="w-full p-2 rounded border border-gray-300 bg-gray-100 text-gray-700 text-sm h-24 resize-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 outline-none"
                                            placeholder="Enter tool parameters..."
                                            value={selectedNode.data?.properties?.parameters || ''}
                                            onChange={(e) => {
                                                const newParameters = e.target.value;
                                                const updateNodeData = (prevData) => ({ ...prevData, properties: { ...prevData.properties, parameters: newParameters } });
                                                setNodes(nodes.map(n => n.id === selectedNode.id ? { ...n, data: updateNodeData(n.data) } : n));
                                                setSelectedNode({ ...selectedNode, data: updateNodeData(selectedNode.data) });
                                            }}
                                        ></textarea>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                )}
                
                <div className={`absolute bottom-2 left-2 ${theme === 'dark' ? 'bg-gray-800' : 'bg-gray-600'} text-white text-[10px] rounded px-1.5 py-0.5 opacity-75 z-20 shadow`}>
                    Alt+Click/Mid Mouse: Pan | Wheel: Zoom
                </div>
            </div>
            
            <style jsx global>{`
                .port {
                    position: absolute;
                    transform: translateY(-50%);
                    width: 18px;
                    height: 18px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    cursor: pointer;
                    pointer-events: auto;
                }
                .input-port { left: -9px; }
                .output-port { right: -9px; }

                .port-icon {
                    width: 10px;
                    height: 10px;
                    color: ${theme === 'dark' ? '#718096' : '#9CA3AF'};
                    transition: all 0.15s ease-in-out;
                    pointer-events: none;
                }
                .port:hover .port-icon,
                .port-icon.hovered {
                    color: ${theme === 'dark' ? '#A0AEC0' : '#4B5563'};
                    transform: scale(1.2);
                }
                 .port-icon.connectable:hover {
                     color: ${theme === 'dark' ? '#63B3ED' : '#3B82F6'};
                     transform: scale(1.3);
                 }
                .form-input-light {
                    display: block;
                    width: 100%;
                    padding: 0.5rem;
                    font-size: 0.875rem;
                    line-height: 1.25rem;
                    color: ${theme === 'dark' ? '#E2E8F0' : '#1F2937'};
                    background-color: ${theme === 'dark' ? '#2D3748' : '#F9FAFB'};
                    border: 1px solid ${theme === 'dark' ? '#4A5568' : '#D1D5DB'};
                    border-radius: 0.375rem;
                    outline: none;
                }
                .form-input-light:focus {
                    border-color: ${theme === 'dark' ? '#4299E1' : '#3B82F6'};
                    box-shadow: 0 0 0 1px ${theme === 'dark' ? '#4299E1' : '#3B82F6'};
                }
                .scrollbar-thin { scrollbar-width: thin; scrollbar-color: ${theme === 'dark' ? '#4A5568 #2D3748' : '#9CA3AF #F3F4F6'}; }
                .scrollbar-thin::-webkit-scrollbar { width: 6px; height: 6px; }
                .scrollbar-thin::-webkit-scrollbar-track { background: ${theme === 'dark' ? '#2D3748' : '#F3F4F6'}; border-radius: 3px;}
                .scrollbar-thin::-webkit-scrollbar-thumb { background-color: ${theme === 'dark' ? '#4A5568' : '#9CA3AF'}; border-radius: 3px; border: 1px solid ${theme === 'dark' ? '#2D3748' : '#F3F4F6'}; }
            `}</style>
        </div>
    );
};

export default CustomAgentPage; 