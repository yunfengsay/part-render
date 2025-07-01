import { PartialRenderer } from '../src/core/PartialRenderer';
import { logger, LogLevel } from '../src/utils/Logger';
import * as fs from 'fs';
import * as path from 'path';

// 配置日志
logger.configure({
  level: LogLevel.DEBUG,
  format: 'detailed'
});

async function demo() {
  // 创建渲染器
  const renderer = new PartialRenderer({
    projectRoot: process.cwd(),
    enableAI: true,
    aiModel: 'qwen3:0.6b',
    mockProps: {
      title: 'Hello World',
      count: 42,
      items: ['Apple', 'Banana', 'Orange']
    }
  });

  // 示例1: 渲染一个简单的函数组件（缺少imports）
  console.log('\n=== Example 1: Simple Function Component ===');
  const simpleComponent = `
function Counter({ count, onIncrement }) {
  return (
    <div>
      <h2>Count: {count}</h2>
      <button onClick={onIncrement}>Increment</button>
    </div>
  );
}
`;

  const result1 = await renderer.renderPartial(simpleComponent);
  if (result1.success) {
    console.log('✅ Rendered successfully');
    console.log('Used imports:', result1.usedImports);
    console.log('Suggestions:', result1.suggestions);
    saveHtml('example1.html', result1.html!);
  } else {
    console.error('❌ Render failed:', result1.error);
  }

  // 示例2: 使用hooks的组件（缺少useState import）
  console.log('\n=== Example 2: Component with Hooks ===');
  const hooksComponent = `
function TodoList({ initialItems = [] }) {
  const [items, setItems] = useState(initialItems);
  const [newItem, setNewItem] = useState('');

  const addItem = () => {
    if (newItem.trim()) {
      setItems([...items, newItem]);
      setNewItem('');
    }
  };

  return (
    <div>
      <h2>Todo List</h2>
      <input 
        value={newItem}
        onChange={(e) => setNewItem(e.target.value)}
        placeholder="Add new item"
      />
      <button onClick={addItem}>Add</button>
      <ul>
        {items.map((item, index) => (
          <li key={index}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
`;

  const result2 = await renderer.renderPartial(hooksComponent);
  if (result2.success) {
    console.log('✅ Rendered successfully');
    console.log('AI suggestions:', result2.suggestions);
    saveHtml('example2.html', result2.html!);
  } else {
    console.error('❌ Render failed:', result2.error);
  }

  // 示例3: 批量渲染
  console.log('\n=== Example 3: Batch Rendering ===');
  const components = [
    {
      name: 'Button',
      code: `
        const Button = ({ label, onClick, variant = 'primary' }) => {
          const className = \`btn btn-\${variant}\`;
          return <button className={className} onClick={onClick}>{label}</button>;
        };
      `
    },
    {
      name: 'Card',
      code: `
        function Card({ title, children }) {
          return (
            <div className="card">
              <h3 className="card-title">{title}</h3>
              <div className="card-body">{children}</div>
            </div>
          );
        }
      `
    }
  ];

  const batchResults = await renderer.renderMultiple(components);
  batchResults.forEach((result, name) => {
    if (result.success) {
      console.log(`✅ ${name} rendered successfully`);
      saveHtml(`${name.toLowerCase()}.html`, result.html!);
    } else {
      console.error(`❌ ${name} failed:`, result.error);
    }
  });

  // 清理
  renderer.dispose();
}

function saveHtml(filename: string, content: string) {
  const outputDir = path.join(__dirname, 'output');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }
  
  const filepath = path.join(outputDir, filename);
  fs.writeFileSync(filepath, content);
  console.log(`📄 Saved to: ${filepath}`);
}

// 运行示例
demo().catch(console.error);