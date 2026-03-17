import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, Dimensions, PanResponder, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Line, Defs, LinearGradient, Stop } from 'react-native-svg';

const { width, height } = Dimensions.get('window');
const FRUIT_EMOJIS = ['🍎', '🍊', '🍋', '🍉', '🍇', '🥝', '🍓', '🍑'];

// 水果对应的切开两半的 emoji
const SLICED_FRUITS = {
  '🍎': ['🍎', '🍎'], // 苹果切成两半
  '🍊': ['🍊', '🍊'],
  '🍋': ['🍋', '🍋'],
  '🍉': ['🍉', '🍉'],
  '🍇': ['🍇', '🍇'],
  '🥝': ['🥝', '🥝'],
  '🍓': ['🍓', '🍓'],
  '🍑': ['🍑', '🍑'],
};

export default function App() {
  const [score, setScore] = useState(0);
  const [fruits, setFruits] = useState([]);
  const [particles, setParticles] = useState([]);
  const [slashLine, setSlashLine] = useState(null);
  const fruitIdRef = useRef(0);
  const particleIdRef = useRef(0);
  const animationRef = useRef(null);

  // 生成水果
  const spawnFruit = useCallback(() => {
    const id = fruitIdRef.current++;
    const emoji = FRUIT_EMOJIS[Math.floor(Math.random() * FRUIT_EMOJIS.length)];
    const startX = Math.random() * (width - 100) + 50;
    
    const newFruit = {
      id,
      emoji,
      x: startX,
      y: height + 50,
      vx: (Math.random() - 0.5) * 4,
      vy: -Math.random() * 12 - 10,
      rotation: 0,
      vRotation: (Math.random() - 0.5) * 10,
      state: 'whole', // 'whole', 'slicing', 'sliced'
      sliceTime: 0,
    };

    setFruits(prev => [...prev, newFruit]);
  }, []);

  // 生成粒子效果
  const spawnParticles = useCallback((x, y) => {
    const newParticles = [];
    for (let i = 0; i < 8; i++) {
      newParticles.push({
        id: particleIdRef.current++,
        x,
        y,
        vx: (Math.random() - 0.5) * 10,
        vy: (Math.random() - 0.5) * 10,
        life: 1,
        color: `hsl(${Math.random() * 60 + 30}, 100%, 50%)`,
      });
    }
    setParticles(prev => [...prev, ...newParticles]);
  }, []);

  // 游戏循环
  useEffect(() => {
    const spawnInterval = setInterval(spawnFruit, 1000);
    
    let lastTime = Date.now();
    const gameLoop = () => {
      const now = Date.now();
      const dt = (now - lastTime) / 16;
      lastTime = now;
      
      // 更新水果
      setFruits(prev => {
        return prev
          .map(fruit => {
            if (fruit.state === 'sliced') return fruit;
            
            // 切开动画
            if (fruit.state === 'slicing') {
              const newTime = fruit.sliceTime + dt;
              return {
                ...fruit,
                sliceTime: newTime,
                state: newTime > 30 ? 'sliced' : 'slicing',
              };
            }
            
            // 正常物理
            let newVy = fruit.vy + 0.4 * dt;
            let newVx = fruit.vx;
            let newY = fruit.y + fruit.vy * dt;
            let newX = fruit.x + fruit.vx * dt;
            
            if (newX < 30 || newX > width - 30) {
              newVx = -newVx * 0.8;
              newX = Math.max(30, Math.min(width - 30, newX));
            }

            return {
              ...fruit,
              x: newX,
              y: newY,
              vx: newVx,
              vy: newVy,
              rotation: fruit.rotation + fruit.vRotation * dt,
            };
          })
          .filter(fruit => fruit.y < height + 100 && fruit.state !== 'sliced');
      });
      
      // 更新粒子
      setParticles(prev => 
        prev
          .map(p => ({
            ...p,
            x: p.x + p.vx * dt,
            y: p.y + p.vy * dt,
            vy: p.vy + 0.5 * dt,
            life: p.life - 0.02 * dt,
          }))
          .filter(p => p.life > 0)
      );
      
      animationRef.current = requestAnimationFrame(gameLoop);
    };
    
    animationRef.current = requestAnimationFrame(gameLoop);

    return () => {
      clearInterval(spawnInterval);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [spawnFruit]);

  // 切水果
  const sliceFruit = useCallback((fruitId, touchX, touchY) => {
    setFruits(prev => prev.map(fruit => {
      if (fruit.id === fruitId && fruit.state === 'whole') {
        setScore(s => s + 10);
        spawnParticles(fruit.x, fruit.y);
        return { 
          ...fruit, 
          state: 'slicing',
          sliceTime: 0,
          leftX: fruit.x - 20,
          rightX: fruit.x + 20,
          leftVy: fruit.vy - 3,
          rightVy: fruit.vy + 2,
          leftVx: fruit.vx - 5,
          rightVx: fruit.vx + 5,
        };
      }
      return fruit;
    }));
  }, [spawnParticles]);

  // 手势处理
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gesture) => {
        setSlashLine({ 
          x1: gesture.x0, y1: gesture.y0, 
          x2: gesture.x0, y2: gesture.y0,
          time: Date.now() 
        });
        checkSlice(gesture.x0, gesture.y0);
      },
      onPanResponderMove: (_, gesture) => {
        const { moveX, moveY } = gesture;
        setSlashLine({ 
          x1: gesture.x0, y1: gesture.y0, 
          x2: moveX, y2: moveY,
          time: Date.now()
        });
        checkSlice(moveX, moveY);
      },
      onPanResponderRelease: () => {
        setTimeout(() => setSlashLine(null), 200);
      },
    })
  ).current;

  // 检查切中
  const checkSlice = useCallback((touchX, touchY) => {
    setFruits(prev => {
      let hit = false;
      return prev.map(fruit => {
        if (fruit.state !== 'whole' || hit) return fruit;
        
        const dist = Math.sqrt((touchX - fruit.x) ** 2 + (touchY - fruit.y) ** 2);
        if (dist < 60) {
          hit = true;
          setScore(s => s + 10);
          spawnParticles(fruit.x, fruit.y);
          return { 
            ...fruit, 
            state: 'slicing',
            sliceTime: 0,
            leftX: fruit.x - 20,
            rightX: fruit.x + 20,
            leftVy: fruit.vy - 3,
            rightVy: fruit.vy + 2,
            leftVx: fruit.vx - 5,
            rightVx: fruit.vx + 5,
          };
        }
        return fruit;
      });
    });
  }, [spawnParticles]);

  const resetGame = () => {
    setScore(0);
    setFruits([]);
    setParticles([]);
    fruitIdRef.current = 0;
    particleIdRef.current = 0;
  };

  // 渲染水果（切开效果）
  const renderFruit = (fruit) => {
    if (fruit.state === 'slicing') {
      const progress = fruit.sliceTime / 30;
      const leftX = fruit.leftX + fruit.leftVx * progress * 5;
      const rightX = fruit.rightX + fruit.rightVx * progress * 5;
      const leftY = fruit.y + fruit.leftVy * progress * 5;
      const rightY = fruit.y + fruit.rightVy * progress * 5;
      
      return (
        <>
          <View style={[styles.fruitHalf, { left: leftX - 30, top: leftY - 30 }]}>
            <Text style={[styles.fruitEmoji, { transform: [{ rotate: '-15deg' }] }]}>
              {fruit.emoji}
            </Text>
          </View>
          <View style={[styles.fruitHalf, { left: rightX - 30, top: rightY - 30 }]}>
            <Text style={[styles.fruitEmoji, { transform: [{ rotate: '15deg' }] }]}>
              {fruit.emoji}
            </Text>
          </View>
        </>
      );
    }
    
    return (
      <View
        style={[
          styles.fruit,
          {
            left: fruit.x - 30,
            top: fruit.y - 30,
            transform: [{ rotate: `${fruit.rotation}deg` }],
          },
        ]}
      >
        <Text style={styles.fruitEmoji}>{fruit.emoji}</Text>
      </View>
    );
  };

  return (
    <View style={styles.container} {...panResponder.panHandlers}>
      <StatusBar style="light" />
      
      {/* 背景 */}
      <View style={styles.background} />
      
      {/* 分数 */}
      <View style={styles.scoreContainer}>
        <Text style={styles.scoreText}>得分: {score}</Text>
      </View>

      {/* 重置按钮 */}
      <TouchableOpacity style={styles.resetButton} onPress={resetGame}>
        <Text style={styles.resetText}>重置</Text>
      </TouchableOpacity>

      {/* 水果 */}
      {fruits.map(fruit => (
        <React.Fragment key={fruit.id}>
          {renderFruit(fruit)}
        </React.Fragment>
      ))}

      {/* 粒子效果 */}
      {particles.map(p => (
        <View
          key={p.id}
          style={[
            styles.particle,
            {
              left: p.x,
              top: p.y,
              backgroundColor: p.color,
              opacity: p.life,
              transform: [{ scale: p.life }],
            },
          ]}
        />
      ))}

      {/* 刀光效果 - 带渐变 */}
      {slashLine && (
        <Svg style={styles.slash} pointerEvents="none">
          <Defs>
            <LinearGradient id="slashGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="rgba(255,255,255,0)" />
              <Stop offset="50%" stopColor="rgba(255,255,255,0.9)" />
              <Stop offset="100%" stopColor="rgba(255,255,200,0.3)" />
            </LinearGradient>
            <LinearGradient id="slashCore" x1="0%" y1="0%" x2="100%" y2="0%">
              <Stop offset="0%" stopColor="rgba(100,200,255,0)" />
              <Stop offset="50%" stopColor="rgba(100,200,255,1)" />
              <Stop offset="100%" stopColor="rgba(200,100,255,0.5)" />
            </LinearGradient>
          </Defs>
          {/* 外发光 */}
          <Line
            x1={slashLine.x1}
            y1={slashLine.y1}
            x2={slashLine.x2}
            y2={slashLine.y2}
            stroke="url(#slashGradient)"
            strokeWidth="12"
            strokeLinecap="round"
          />
          {/* 核心刀光 */}
          <Line
            x1={slashLine.x1}
            y1={slashLine.y1}
            x2={slashLine.x2}
            y2={slashLine.y2}
            stroke="url(#slashCore)"
            strokeWidth="4"
            strokeLinecap="round"
          />
          {/* 白色核心 */}
          <Line
            x1={slashLine.x1}
            y1={slashLine.y1}
            x2={slashLine.x2}
            y2={slashLine.y2}
            stroke="white"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </Svg>
      )}

      {/* 提示 */}
      <View style={styles.hint}>
        <Text style={styles.hintText}>滑动屏幕切水果！</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1a1a2e',
  },
  background: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1a1a2e',
  },
  scoreContainer: {
    position: 'absolute',
    top: 50,
    left: 20,
    zIndex: 100,
  },
  scoreText: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
  },
  resetButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    backgroundColor: '#e74c3c',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
    zIndex: 100,
  },
  resetText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  fruit: {
    position: 'absolute',
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fruitHalf: {
    position: 'absolute',
    width: 60,
    height: 60,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fruitEmoji: {
    fontSize: 50,
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
    borderRadius: 4,
    marginLeft: -4,
    marginTop: -4,
  },
  slash: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    pointerEvents: 'none',
  },
  hint: {
    position: 'absolute',
    bottom: 100,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  hintText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
  },
});