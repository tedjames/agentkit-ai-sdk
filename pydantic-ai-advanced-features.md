# Pydantic-AI: Advanced Features and Patterns

## 1. Pydantic Graph System

Pydantic Graph provides a powerful way to define complex agent workflows using type hints.

### Graph Architecture

```mermaid
classDiagram
    class Graph {
        +nodes: Dict[str, Node]
        +edges: List[Edge]
        +run(start_data: Any)
        +visualize(): str
    }
    
    class Node {
        <<abstract>>
        +name: str
        +execute(input: Any): Any
    }
    
    class AgentNode {
        +agent: Agent
        +execute(input: Any): Any
    }
    
    class FunctionNode {
        +func: Callable
        +execute(input: Any): Any
    }
    
    class DecisionNode {
        +condition: Callable
        +execute(input: Any): str
    }
    
    class Edge {
        +from_node: str
        +to_node: str
        +condition: Optional[Callable]
    }
    
    Graph --> Node
    Graph --> Edge
    Node <|-- AgentNode
    Node <|-- FunctionNode
    Node <|-- DecisionNode
```

### Graph Execution Flow

```mermaid
sequenceDiagram
    participant User
    participant Graph
    participant NodeExecutor
    participant Node1[Start Node]
    participant Node2[Process Node]
    participant Decision[Decision Node]
    participant NodeA[Path A Node]
    participant NodeB[Path B Node]
    participant End[End Node]
    
    User->>Graph: run(initial_data)
    Graph->>NodeExecutor: Execute workflow
    
    NodeExecutor->>Node1: execute(initial_data)
    Node1-->>NodeExecutor: result1
    
    NodeExecutor->>Node2: execute(result1)
    Node2-->>NodeExecutor: result2
    
    NodeExecutor->>Decision: execute(result2)
    Decision-->>NodeExecutor: "path_a" or "path_b"
    
    alt Path A
        NodeExecutor->>NodeA: execute(result2)
        NodeA-->>NodeExecutor: resultA
    else Path B
        NodeExecutor->>NodeB: execute(result2)
        NodeB-->>NodeExecutor: resultB
    end
    
    NodeExecutor->>End: execute(final_result)
    End-->>Graph: final_output
    Graph-->>User: final_output
```

### Graph Definition Pattern

```python
from pydantic_graph import Graph, Node, edge

class AnalysisNode(Node):
    agent: Agent[AnalysisDeps, AnalysisResult]
    
    async def execute(self, input_data: InputData) -> AnalysisResult:
        return await self.agent.run(str(input_data))

class DecisionNode(Node):
    def execute(self, analysis: AnalysisResult) -> str:
        if analysis.risk_score > 0.7:
            return "high_risk_path"
        return "normal_path"

# Define graph
graph = Graph()
graph.add_node("start", DataPrepNode())
graph.add_node("analysis", AnalysisNode(agent=analysis_agent))
graph.add_node("decision", DecisionNode())
graph.add_node("high_risk", HighRiskHandler())
graph.add_node("normal", NormalHandler())

# Define edges
graph.add_edge("start", "analysis")
graph.add_edge("analysis", "decision")
graph.add_edge("decision", "high_risk", condition=lambda r: r == "high_risk_path")
graph.add_edge("decision", "normal", condition=lambda r: r == "normal_path")
```

## 2. Memory and Persistence System

### Conversation Memory Architecture

```mermaid
classDiagram
    class MemoryManager {
        +store: MemoryStore
        +save_conversation(id: str, messages: List[Message])
        +load_conversation(id: str): List[Message]
        +search_similar(query: str): List[Conversation]
    }
    
    class MemoryStore {
        <<interface>>
        +save(key: str, value: Any)
        +load(key: str): Any
        +search(query: Dict): List[Any]
    }
    
    class RedisStore {
        +client: Redis
        +save(key: str, value: Any)
        +load(key: str): Any
    }
    
    class PostgresStore {
        +conn: AsyncPG
        +save(key: str, value: Any)
        +load(key: str): Any
        +vector_search(embedding: List[float])
    }
    
    class InMemoryStore {
        +data: Dict
        +save(key: str, value: Any)
        +load(key: str): Any
    }
    
    MemoryManager --> MemoryStore
    MemoryStore <|-- RedisStore
    MemoryStore <|-- PostgresStore
    MemoryStore <|-- InMemoryStore
    
    class ConversationState {
        +id: str
        +messages: List[Message]
        +metadata: Dict
        +created_at: datetime
        +updated_at: datetime
    }
    
    MemoryManager --> ConversationState
```

### Stateful Agent Pattern

```mermaid
sequenceDiagram
    participant User
    participant StatefulAgent
    participant MemoryManager
    participant Store
    participant Agent
    
    User->>StatefulAgent: run(prompt, session_id="123")
    
    StatefulAgent->>MemoryManager: load_conversation("123")
    MemoryManager->>Store: get("conv:123")
    Store-->>MemoryManager: Previous messages
    MemoryManager-->>StatefulAgent: Conversation history
    
    StatefulAgent->>Agent: run(prompt, history=messages)
    Agent-->>StatefulAgent: Response
    
    StatefulAgent->>MemoryManager: save_conversation("123", updated_messages)
    MemoryManager->>Store: set("conv:123", messages)
    
    StatefulAgent-->>User: Response with context
```

### Implementing Conversation Memory

```python
class StatefulAgent:
    def __init__(self, agent: Agent, memory: MemoryManager):
        self.agent = agent
        self.memory = memory
    
    async def run(
        self, 
        prompt: str, 
        session_id: str,
        deps: Any = None
    ) -> Result:
        # Load conversation history
        history = await self.memory.load_conversation(session_id)
        
        # Build context with history
        context_prompt = self._build_context(history, prompt)
        
        # Run agent with context
        result = await self.agent.run(context_prompt, deps)
        
        # Save updated conversation
        updated_history = history + [
            UserMessage(content=prompt),
            AssistantMessage(content=result.output)
        ]
        await self.memory.save_conversation(session_id, updated_history)
        
        return result
```

## 3. Multi-Agent Orchestration

### Orchestration Patterns

```mermaid
graph TB
    subgraph "Orchestration Patterns"
        subgraph "Sequential"
            A1[Agent 1] --> A2[Agent 2] --> A3[Agent 3]
        end
        
        subgraph "Parallel"
            B0[Splitter] --> B1[Agent 1]
            B0 --> B2[Agent 2]
            B0 --> B3[Agent 3]
            B1 --> B4[Merger]
            B2 --> B4
            B3 --> B4
        end
        
        subgraph "Hierarchical"
            C1[Supervisor] --> C2[Worker 1]
            C1 --> C3[Worker 2]
            C2 --> C1
            C3 --> C1
        end
        
        subgraph "Pipeline"
            D1[Extractor] --> D2[Transformer] --> D3[Loader]
        end
    end
```

### Multi-Agent Communication

```mermaid
sequenceDiagram
    participant User
    participant Orchestrator
    participant MessageBus
    participant Agent1
    participant Agent2
    participant Agent3
    participant SharedContext
    
    User->>Orchestrator: Complex request
    Orchestrator->>SharedContext: Initialize context
    
    Orchestrator->>MessageBus: Publish task
    
    par Agent 1 Processing
        MessageBus->>Agent1: Task assignment
        Agent1->>SharedContext: Get relevant data
        Agent1->>Agent1: Process
        Agent1->>MessageBus: Publish result
    and Agent 2 Processing
        MessageBus->>Agent2: Task assignment
        Agent2->>SharedContext: Get relevant data
        Agent2->>Agent2: Process
        Agent2->>MessageBus: Publish result
    end
    
    MessageBus->>Agent3: Aggregate task
    Agent3->>MessageBus: Subscribe to results
    Agent3->>Agent3: Combine results
    Agent3->>Orchestrator: Final result
    
    Orchestrator-->>User: Combined response
```

### Agent Communication Protocol

```python
@dataclass
class AgentMessage:
    sender: str
    receiver: str
    content: Any
    message_type: Literal["request", "response", "broadcast"]
    correlation_id: str
    timestamp: datetime

class MessageBus:
    def __init__(self):
        self._subscribers: Dict[str, List[Callable]] = {}
        self._message_queue: asyncio.Queue = asyncio.Queue()
    
    async def publish(self, message: AgentMessage):
        await self._message_queue.put(message)
        await self._notify_subscribers(message)
    
    def subscribe(self, agent_id: str, handler: Callable):
        self._subscribers.setdefault(agent_id, []).append(handler)

class MultiAgentOrchestrator:
    def __init__(self, agents: Dict[str, Agent], bus: MessageBus):
        self.agents = agents
        self.bus = bus
        self._setup_subscriptions()
    
    async def execute_workflow(self, request: Any) -> Any:
        # Define workflow logic
        pass
```

## 4. Advanced Persistence Patterns

### Event Sourcing for Agent Actions

```mermaid
classDiagram
    class EventStore {
        +append(event: Event)
        +get_events(aggregate_id: str): List[Event]
        +get_snapshot(aggregate_id: str): Snapshot
    }
    
    class Event {
        +id: str
        +aggregate_id: str
        +event_type: str
        +data: Dict
        +timestamp: datetime
    }
    
    class AgentEvent {
        +agent_id: str
        +action: str
        +input: Any
        +output: Any
        +metadata: Dict
    }
    
    class ConversationAggregate {
        +id: str
        +events: List[Event]
        +apply(event: Event)
        +get_state(): ConversationState
    }
    
    EventStore --> Event
    Event <|-- AgentEvent
    ConversationAggregate --> Event
```

### Checkpointing and Recovery

```mermaid
sequenceDiagram
    participant Agent
    participant CheckpointManager
    participant Storage
    participant Recovery
    
    loop During execution
        Agent->>Agent: Execute step
        Agent->>CheckpointManager: Save checkpoint
        CheckpointManager->>Storage: Persist state
        Storage-->>CheckpointManager: Confirmed
    end
    
    Note over Agent: Failure occurs
    
    Recovery->>Storage: Load last checkpoint
    Storage-->>Recovery: Checkpoint data
    Recovery->>Agent: Restore state
    Agent->>Agent: Resume from checkpoint
```

## 5. Semantic Router for Multi-Agent Systems

### Router Architecture

```mermaid
flowchart TD
    Input[User Input] --> Embedder[Text Embedder]
    Embedder --> Vector[Input Vector]
    
    Vector --> Similarity{Similarity Search}
    
    subgraph "Agent Registry"
        A1[Customer Service Agent<br/>Embedding: [...]]
        A2[Technical Support Agent<br/>Embedding: [...]]
        A3[Sales Agent<br/>Embedding: [...]]
    end
    
    Similarity --> A1
    Similarity --> A2
    Similarity --> A3
    
    Similarity --> Best[Best Match]
    Best --> Route[Route to Agent]
```

### Semantic Router Implementation

```python
class SemanticRouter:
    def __init__(self, embedder: Embedder):
        self.embedder = embedder
        self.routes: List[Route] = []
    
    def add_route(
        self, 
        agent: Agent, 
        description: str,
        examples: List[str]
    ):
        # Create embeddings for examples
        embeddings = [self.embedder.embed(ex) for ex in examples]
        
        route = Route(
            agent=agent,
            description=description,
            embeddings=embeddings
        )
        self.routes.append(route)
    
    async def route(self, query: str) -> Agent:
        query_embedding = self.embedder.embed(query)
        
        # Find best matching route
        best_route = max(
            self.routes,
            key=lambda r: max(
                cosine_similarity(query_embedding, e) 
                for e in r.embeddings
            )
        )
        
        return best_route.agent
```

## 6. Evaluation and Monitoring System

### Evaluation Framework

```mermaid
classDiagram
    class EvaluationFramework {
        +evaluators: List[Evaluator]
        +run_evaluation(dataset: Dataset): Report
    }
    
    class Evaluator {
        <<abstract>>
        +evaluate(input: Any, output: Any, expected: Any): Score
    }
    
    class AccuracyEvaluator {
        +evaluate(): Score
    }
    
    class LatencyEvaluator {
        +evaluate(): Score
    }
    
    class CostEvaluator {
        +evaluate(): Score
    }
    
    class Dataset {
        +examples: List[Example]
        +metadata: Dict
    }
    
    class Example {
        +input: Any
        +expected_output: Any
        +metadata: Dict
    }
    
    class Report {
        +scores: Dict[str, Score]
        +visualize(): Chart
    }
    
    EvaluationFramework --> Evaluator
    Evaluator <|-- AccuracyEvaluator
    Evaluator <|-- LatencyEvaluator
    Evaluator <|-- CostEvaluator
    EvaluationFramework --> Dataset
    Dataset --> Example
    EvaluationFramework --> Report
```

### Real-time Monitoring

```mermaid
sequenceDiagram
    participant Agent
    participant Monitor
    participant Metrics
    participant Alerts
    participant Dashboard
    
    loop During execution
        Agent->>Monitor: Log event
        Monitor->>Metrics: Update metrics
        
        Monitor->>Monitor: Check thresholds
        alt Threshold exceeded
            Monitor->>Alerts: Trigger alert
            Alerts->>Alerts: Send notification
        end
        
        Metrics->>Dashboard: Stream updates
        Dashboard->>Dashboard: Update visualizations
    end
```

## 7. Advanced Tool Patterns

### Composite Tools

```python
class CompositeTool:
    """Tool that combines multiple sub-tools"""
    
    def __init__(self, tools: List[Tool]):
        self.tools = tools
    
    async def execute(self, ctx: RunContext, **kwargs) -> Any:
        results = {}
        
        # Execute tools in sequence or parallel
        for tool in self.tools:
            result = await tool.execute(ctx, **kwargs)
            results[tool.name] = result
        
        # Combine results
        return self._combine_results(results)
```

### Tool Middleware

```mermaid
sequenceDiagram
    participant Agent
    participant Middleware
    participant RateLimiter
    participant Cache
    participant Logger
    participant Tool
    
    Agent->>Middleware: Execute tool
    
    Middleware->>RateLimiter: Check rate limit
    alt Rate limit OK
        Middleware->>Cache: Check cache
        alt Cache hit
            Cache-->>Middleware: Cached result
            Middleware-->>Agent: Return cached
        else Cache miss
            Middleware->>Logger: Log request
            Middleware->>Tool: Execute
            Tool-->>Middleware: Result
            Middleware->>Cache: Store result
            Middleware->>Logger: Log response
            Middleware-->>Agent: Return result
        end
    else Rate limited
        RateLimiter-->>Agent: Rate limit error
    end
```

## 8. Advanced Streaming Patterns

### Stream Processing Pipeline

```python
class StreamProcessor:
    def __init__(self):
        self.transformers: List[StreamTransformer] = []
        self.aggregators: List[StreamAggregator] = []
    
    async def process_stream(
        self, 
        stream: AsyncIterator[Event]
    ) -> AsyncIterator[ProcessedEvent]:
        async for event in stream:
            # Apply transformations
            transformed = event
            for transformer in self.transformers:
                transformed = await transformer.transform(transformed)
            
            # Update aggregators
            for aggregator in self.aggregators:
                await aggregator.update(transformed)
            
            # Yield processed event
            yield ProcessedEvent(
                original=event,
                transformed=transformed,
                aggregates=self._get_aggregates()
            )
```

### Backpressure Handling

```mermaid
stateDiagram-v2
    [*] --> Streaming
    
    Streaming --> CheckBuffer: New chunk
    CheckBuffer --> BufferFull: Buffer > threshold
    CheckBuffer --> ProcessChunk: Buffer OK
    
    BufferFull --> ApplyBackpressure
    ApplyBackpressure --> SlowDown: Reduce rate
    ApplyBackpressure --> DropOldest: Drop old chunks
    
    SlowDown --> CheckBuffer
    DropOldest --> ProcessChunk
    
    ProcessChunk --> EmitEvent
    EmitEvent --> Streaming
```