# Letta Implementation Guide & Code Examples

## Table of Contents
1. [Quick Start Implementation](#quick-start-implementation)
2. [Core Concepts in Code](#core-concepts-in-code)
3. [Memory Management Implementation](#memory-management-implementation)
4. [Tool Development](#tool-development)
5. [Advanced Agent Patterns](#advanced-agent-patterns)
6. [Real-World Use Cases](#real-world-use-cases)
7. [Performance Tuning](#performance-tuning)
8. [Deployment Architecture](#deployment-architecture)

## Quick Start Implementation

### Basic Agent Creation

```python
from letta_client import Letta

# Initialize client
client = Letta(base_url="http://localhost:8283")

# Create a basic agent
agent_state = client.agents.create_agent(
    name="CustomerSupportAgent",
    preset="memgpt_chat",
    persona="You are a helpful customer support agent for ACME Corp.",
    human="The user is a customer seeking assistance.",
    model="gpt-4",
    context_window=8192
)

# Send a message
response = client.agents.send_message(
    agent_id=agent_state.id,
    message="Hello, I need help with my order"
)
```

### TypeScript/Node.js Implementation

```typescript
import { LettaClient } from '@letta-ai/letta-client';

// Initialize client
const client = new LettaClient({ baseUrl: "http://localhost:8283" });

// Create agent
const agent = await client.agents.createAgent({
    name: "CustomerSupportAgent",
    preset: "memgpt_chat",
    persona: "You are a helpful customer support agent for ACME Corp.",
    human: "The user is a customer seeking assistance.",
    model: "gpt-4",
    contextWindow: 8192
});

// Send message
const response = await client.agents.sendMessage(
    agent.id,
    "Hello, I need help with my order"
);
```

## Core Concepts in Code

### Agent State Structure

```python
# Agent state contains all persistent information
class AgentState:
    def __init__(self):
        self.id: str = generate_uuid()
        self.name: str = "MyAgent"
        self.created_at: datetime = datetime.now()
        
        # Model configuration
        self.model_config = {
            "model": "gpt-4",
            "context_window": 8192,
            "temperature": 0.7,
            "max_tokens": 1000
        }
        
        # Memory components
        self.core_memory = {
            "persona": "Agent personality and instructions",
            "human": "Information about the user",
            "custom_blocks": {}  # Additional memory blocks
        }
        
        # Conversation state
        self.messages: List[Message] = []
        self.message_buffer: List[Message] = []
        
        # Tools
        self.tools: List[Tool] = []
        self.tool_rules: List[ToolRule] = []
        
        # Metadata
        self.metadata: Dict[str, Any] = {}
```

### Message Processing Pipeline

```python
class MessageProcessor:
    async def process_message(self, agent_id: str, user_message: str):
        # 1. Load agent state
        agent = await self.load_agent(agent_id)
        
        # 2. Prepare context window
        context = self.prepare_context(agent)
        
        # 3. Add user message
        context.add_message(role="user", content=user_message)
        
        # 4. Send to LLM
        llm_response = await self.llm.generate(
            messages=context.messages,
            tools=agent.tools,
            model=agent.model_config["model"]
        )
        
        # 5. Process function calls
        if llm_response.function_calls:
            for func_call in llm_response.function_calls:
                result = await self.execute_tool(func_call)
                context.add_function_result(func_call.id, result)
                
                # Get next LLM response
                llm_response = await self.llm.generate(
                    messages=context.messages,
                    model=agent.model_config["model"]
                )
        
        # 6. Save state
        await self.save_agent_state(agent)
        
        return llm_response.content
```

## Memory Management Implementation

### Core Memory Operations

```python
class CoreMemoryManager:
    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        self.memory_blocks = {}
    
    def append(self, block_name: str, content: str):
        """Append content to a memory block"""
        if block_name not in self.memory_blocks:
            raise ValueError(f"Memory block '{block_name}' not found")
        
        current = self.memory_blocks[block_name]
        self.memory_blocks[block_name] = f"{current}\n{content}"
        self._persist_changes()
    
    def replace(self, block_name: str, old_content: str, new_content: str):
        """Replace specific content in a memory block"""
        if block_name not in self.memory_blocks:
            raise ValueError(f"Memory block '{block_name}' not found")
        
        current = self.memory_blocks[block_name]
        if old_content not in current:
            raise ValueError(f"Content to replace not found in {block_name}")
        
        self.memory_blocks[block_name] = current.replace(old_content, new_content)
        self._persist_changes()
    
    def _persist_changes(self):
        """Save memory state to database"""
        db.update_agent_memory(self.agent_id, self.memory_blocks)
```

### Archival Memory Implementation

```python
class ArchivalMemoryManager:
    def __init__(self, agent_id: str, embedding_model: str):
        self.agent_id = agent_id
        self.embedding_model = embedding_model
        self.vector_db = VectorDatabase()
    
    async def insert(self, content: str, metadata: Dict = None):
        """Insert content into archival memory with embeddings"""
        # Generate embedding
        embedding = await self.generate_embedding(content)
        
        # Create passage
        passage = {
            "id": generate_uuid(),
            "agent_id": self.agent_id,
            "content": content,
            "embedding": embedding,
            "metadata": metadata or {},
            "created_at": datetime.now()
        }
        
        # Store in vector database
        await self.vector_db.insert(passage)
        
        return passage["id"]
    
    async def search(self, query: str, n_results: int = 5):
        """Search archival memory using semantic similarity"""
        # Generate query embedding
        query_embedding = await self.generate_embedding(query)
        
        # Perform similarity search
        results = await self.vector_db.similarity_search(
            embedding=query_embedding,
            filter={"agent_id": self.agent_id},
            limit=n_results
        )
        
        return [
            {
                "content": r["content"],
                "score": r["score"],
                "metadata": r["metadata"]
            }
            for r in results
        ]
```

### Context Window Management

```python
class ContextWindowManager:
    def __init__(self, max_tokens: int = 8192):
        self.max_tokens = max_tokens
        self.token_counter = TokenCounter()
    
    def prepare_context(self, agent: Agent) -> Context:
        """Prepare context window with memory and messages"""
        context = Context()
        
        # Add system prompt
        system_tokens = self.token_counter.count(agent.system_prompt)
        context.add_system(agent.system_prompt)
        
        # Add core memory
        memory_content = self.format_core_memory(agent.core_memory)
        memory_tokens = self.token_counter.count(memory_content)
        context.add_memory(memory_content)
        
        # Calculate remaining tokens for messages
        base_tokens = system_tokens + memory_tokens
        remaining_tokens = self.max_tokens - base_tokens - 500  # Buffer
        
        # Add messages from history
        messages_to_add = []
        current_tokens = 0
        
        for message in reversed(agent.messages):
            msg_tokens = self.token_counter.count(message.content)
            if current_tokens + msg_tokens > remaining_tokens:
                break
            messages_to_add.append(message)
            current_tokens += msg_tokens
        
        # Add messages in chronological order
        for message in reversed(messages_to_add):
            context.add_message(message)
        
        return context
```

## Tool Development

### Creating Custom Tools

```python
# Tool definition with JSON schema
def create_order_lookup_tool():
    return {
        "name": "lookup_order",
        "description": "Look up order details by order ID",
        "json_schema": {
            "type": "object",
            "properties": {
                "order_id": {
                    "type": "string",
                    "description": "The order ID to look up"
                }
            },
            "required": ["order_id"]
        },
        "source_code": '''
def lookup_order(order_id: str) -> str:
    """Look up order details from the database"""
    import json
    
    # Simulated database lookup
    orders_db = {
        "ORD-12345": {
            "status": "shipped",
            "tracking": "1Z999AA1234567890",
            "items": ["Widget A", "Widget B"],
            "total": "$49.99"
        }
    }
    
    if order_id in orders_db:
        order = orders_db[order_id]
        return f"Order {order_id}: Status={order['status']}, Tracking={order['tracking']}, Total={order['total']}"
    else:
        return f"Order {order_id} not found"
'''
    }

# Register tool with agent
tool = create_order_lookup_tool()
client.agents.add_tool(agent_id=agent.id, tool=tool)
```

### Tool Composition Pattern

```python
class CompositeToolExecutor:
    """Execute multiple tools in sequence based on rules"""
    
    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        self.tools = {}
        self.rules = []
    
    def add_rule(self, condition: str, tool_sequence: List[str]):
        """Add a rule for tool sequencing"""
        self.rules.append({
            "condition": condition,
            "sequence": tool_sequence
        })
    
    async def execute_with_rules(self, initial_input: Dict):
        """Execute tools based on rules"""
        results = []
        context = initial_input
        
        for rule in self.rules:
            if self.evaluate_condition(rule["condition"], context):
                for tool_name in rule["sequence"]:
                    result = await self.execute_tool(tool_name, context)
                    results.append(result)
                    context.update(result)
        
        return results
```

## Advanced Agent Patterns

### Multi-Stage Research Agent

```python
class ResearchAgent:
    """Agent that performs multi-stage research"""
    
    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        self.stages = []
    
    async def research(self, topic: str, depth: int = 3):
        """Perform deep research on a topic"""
        # Stage 1: Initial exploration
        initial_queries = await self.generate_initial_queries(topic)
        initial_results = await self.search_web(initial_queries)
        
        # Stage 2: Deep dive
        insights = []
        for result in initial_results:
            # Extract key concepts
            concepts = await self.extract_concepts(result)
            
            # Generate follow-up queries
            followup_queries = await self.generate_followup_queries(concepts)
            
            # Search for each follow-up
            for query in followup_queries[:depth]:
                deep_results = await self.search_web([query])
                insights.extend(deep_results)
        
        # Stage 3: Synthesis
        report = await self.synthesize_report(initial_results + insights)
        
        # Store in archival memory
        await self.store_research(topic, report)
        
        return report
```

### Conversational Agent with Memory Evolution

```python
class EvolvingConversationAgent:
    """Agent that evolves its understanding over time"""
    
    def __init__(self, agent_id: str):
        self.agent_id = agent_id
        self.conversation_patterns = {}
        self.user_preferences = {}
    
    async def process_with_learning(self, message: str):
        """Process message while learning from interaction"""
        # Standard processing
        response = await self.process_message(message)
        
        # Learn from interaction
        await self.learn_from_interaction(message, response)
        
        # Update core memory if significant learning occurred
        if self.should_update_memory():
            await self.update_core_memory_with_learnings()
        
        return response
    
    async def learn_from_interaction(self, user_msg: str, agent_response: str):
        """Extract patterns and preferences from conversation"""
        # Analyze sentiment
        sentiment = await self.analyze_sentiment(user_msg)
        
        # Extract topics
        topics = await self.extract_topics(user_msg)
        
        # Update patterns
        for topic in topics:
            if topic not in self.conversation_patterns:
                self.conversation_patterns[topic] = []
            self.conversation_patterns[topic].append({
                "message": user_msg,
                "response": agent_response,
                "sentiment": sentiment,
                "timestamp": datetime.now()
            })
        
        # Infer preferences
        if sentiment > 0.7:  # Positive response
            self.user_preferences[topics[0]] = "positive"
```

## Real-World Use Cases

### 1. Customer Support System

```python
class CustomerSupportSystem:
    """Complete customer support implementation"""
    
    def __init__(self):
        self.client = Letta(base_url="http://localhost:8283")
        self.agents = {}
    
    async def create_support_agent(self, company_name: str, knowledge_base: List[str]):
        """Create a specialized support agent"""
        # Create agent with company-specific persona
        agent = await self.client.agents.create_agent(
            name=f"{company_name}_Support",
            persona=f"You are a knowledgeable and helpful customer support agent for {company_name}.",
            human="The user is a customer who may have questions, issues, or feedback.",
            tools=[
                "lookup_order",
                "check_inventory",
                "create_ticket",
                "search_knowledge_base"
            ]
        )
        
        # Load knowledge base into archival memory
        for doc in knowledge_base:
            await self.client.archival_memory.insert(
                agent_id=agent.id,
                content=doc
            )
        
        self.agents[company_name] = agent
        return agent
    
    async def handle_customer_query(self, company: str, query: str):
        """Handle a customer support query"""
        agent = self.agents[company]
        
        # First, search knowledge base
        kb_results = await self.client.archival_memory.search(
            agent_id=agent.id,
            query=query,
            n_results=3
        )
        
        # Process with context
        response = await self.client.agents.send_message(
            agent_id=agent.id,
            message=query,
            context={"knowledge_base_results": kb_results}
        )
        
        return response
```

### 2. Personal Assistant with Calendar Integration

```python
class PersonalAssistant:
    """Personal assistant with memory and calendar integration"""
    
    def __init__(self, user_id: str):
        self.user_id = user_id
        self.agent = None
        self.calendar_service = CalendarService()
    
    async def initialize(self):
        """Initialize personal assistant for user"""
        # Create agent with personalized memory
        self.agent = await client.agents.create_agent(
            name=f"PersonalAssistant_{self.user_id}",
            persona="You are a highly capable personal assistant.",
            human=f"User {self.user_id} - professional who needs help with scheduling and tasks.",
            tools=[
                "check_calendar",
                "create_event",
                "set_reminder",
                "search_emails",
                "create_task"
            ]
        )
        
        # Load user preferences
        await self.load_user_preferences()
    
    async def process_request(self, request: str):
        """Process user request with context awareness"""
        # Get current context
        context = {
            "current_time": datetime.now(),
            "upcoming_events": await self.get_upcoming_events(),
            "pending_tasks": await self.get_pending_tasks()
        }
        
        # Process with agent
        response = await client.agents.send_message(
            agent_id=self.agent.id,
            message=request,
            context=context
        )
        
        return response
```

### 3. Code Review Assistant

```python
class CodeReviewAssistant:
    """AI code reviewer with memory of past reviews"""
    
    def __init__(self, repository: str):
        self.repository = repository
        self.agent = None
        self.review_patterns = {}
    
    async def review_pull_request(self, pr_id: str, files: List[Dict]):
        """Review a pull request"""
        # Prepare context with past reviews
        similar_reviews = await self.find_similar_reviews(files)
        
        review_results = []
        for file in files:
            # Review each file
            review = await client.agents.send_message(
                agent_id=self.agent.id,
                message=f"Review this code change: {file['diff']}",
                context={
                    "file_path": file['path'],
                    "language": file['language'],
                    "similar_reviews": similar_reviews.get(file['path'], [])
                }
            )
            
            review_results.append({
                "file": file['path'],
                "review": review,
                "severity": self.assess_severity(review)
            })
            
            # Learn from this review
            await self.store_review_pattern(file, review)
        
        return self.compile_review_summary(review_results)
```

## Performance Tuning

### Optimizing Context Window Usage

```python
class OptimizedContextManager:
    """Optimize context window for maximum efficiency"""
    
    def __init__(self, max_tokens: int = 8192):
        self.max_tokens = max_tokens
        self.compression_enabled = True
    
    def optimize_context(self, agent: Agent) -> Context:
        """Optimize context using various strategies"""
        # 1. Compress old messages
        compressed_messages = self.compress_old_messages(agent.messages)
        
        # 2. Prioritize recent and important messages
        prioritized = self.prioritize_messages(compressed_messages)
        
        # 3. Dynamic memory allocation
        memory_allocation = self.calculate_memory_allocation(agent)
        
        # 4. Build optimized context
        context = Context()
        context.add_system(agent.system_prompt)
        context.add_memory(self.format_memory(agent.core_memory, memory_allocation))
        
        for message in prioritized:
            if context.token_count + message.tokens < self.max_tokens - 500:
                context.add_message(message)
        
        return context
```

### Caching Strategy

```python
class AgentCache:
    """Intelligent caching for agent responses"""
    
    def __init__(self, ttl: int = 3600):
        self.cache = {}
        self.ttl = ttl
        self.similarity_threshold = 0.85
    
    async def get_or_compute(self, agent_id: str, query: str, compute_fn):
        """Get from cache or compute new response"""
        # Check exact match
        cache_key = f"{agent_id}:{query}"
        if cache_key in self.cache:
            entry = self.cache[cache_key]
            if time.time() - entry['timestamp'] < self.ttl:
                return entry['response']
        
        # Check semantic similarity
        similar = await self.find_similar_query(agent_id, query)
        if similar and similar['score'] > self.similarity_threshold:
            return similar['response']
        
        # Compute new response
        response = await compute_fn()
        
        # Cache result
        self.cache[cache_key] = {
            'response': response,
            'embedding': await self.embed(query),
            'timestamp': time.time()
        }
        
        return response
```

## Deployment Architecture

### Production Deployment Configuration

```yaml
# docker-compose.production.yml
version: '3.8'

services:
  letta-server:
    image: letta/letta:latest
    environment:
      - POSTGRES_URI=postgresql://user:pass@postgres:5432/letta
      - REDIS_URL=redis://redis:6379
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - SECURE=true
      - LETTA_SERVER_PASSWORD=${LETTA_PASSWORD}
    ports:
      - "8283:8283"
    depends_on:
      - postgres
      - redis
    deploy:
      replicas: 3
      resources:
        limits:
          cpus: '2'
          memory: 4G
    
  postgres:
    image: postgres:15
    environment:
      - POSTGRES_DB=letta
      - POSTGRES_USER=user
      - POSTGRES_PASSWORD=pass
    volumes:
      - postgres_data:/var/lib/postgresql/data
    deploy:
      placement:
        constraints:
          - node.role == manager
  
  redis:
    image: redis:7-alpine
    command: redis-server --appendonly yes
    volumes:
      - redis_data:/data
    
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf
      - ./certs:/etc/nginx/certs
    depends_on:
      - letta-server

volumes:
  postgres_data:
  redis_data:
```

### Kubernetes Deployment

```yaml
# letta-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: letta-server
spec:
  replicas: 3
  selector:
    matchLabels:
      app: letta
  template:
    metadata:
      labels:
        app: letta
    spec:
      containers:
      - name: letta
        image: letta/letta:latest
        env:
        - name: POSTGRES_URI
          valueFrom:
            secretKeyRef:
              name: letta-secrets
              key: postgres-uri
        - name: OPENAI_API_KEY
          valueFrom:
            secretKeyRef:
              name: letta-secrets
              key: openai-api-key
        ports:
        - containerPort: 8283
        resources:
          requests:
            memory: "2Gi"
            cpu: "1"
          limits:
            memory: "4Gi"
            cpu: "2"
        livenessProbe:
          httpGet:
            path: /health
            port: 8283
          initialDelaySeconds: 30
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: letta-service
spec:
  selector:
    app: letta
  ports:
  - protocol: TCP
    port: 80
    targetPort: 8283
  type: LoadBalancer
```

## Best Practices Summary

### 1. Memory Management
- Keep core memory concise and relevant
- Use archival memory for detailed information
- Implement memory compression for long conversations
- Regular cleanup of outdated information

### 2. Tool Design
- Keep tools focused on single responsibilities
- Validate all inputs thoroughly
- Handle errors gracefully
- Document expected outputs clearly

### 3. Performance
- Cache frequently used responses
- Implement request batching
- Use connection pooling for databases
- Monitor token usage and optimize

### 4. Security
- Always validate and sanitize inputs
- Use environment variables for secrets
- Implement rate limiting
- Regular security audits of custom tools

### 5. Monitoring
- Track agent performance metrics
- Monitor memory usage patterns
- Log all tool executions
- Set up alerts for anomalies

## Conclusion

Letta provides a powerful framework for building stateful AI agents with sophisticated memory management and tool capabilities. By following these implementation patterns and best practices, you can create robust, scalable, and intelligent agent systems that maintain context over extended periods and provide genuine value to users.

The key to success with Letta is understanding its memory architecture and leveraging its persistence capabilities to create agents that truly learn and evolve over time, rather than treating each interaction as isolated events.