import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, Dimensions, Animated, PanResponder, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Line } from 'react-native-svg';

const { width, height } = Dimensions.get('window');
const FRUIT_EMOJIS = ['🍎', '🍊', '🍋', '🍉', '🍇', '🥝', '🍓', '🍑'];

export default function App() {
  const [score, setScore] = useState(0);
  const [fruits, setFruits] = useState([]);
  const [slashLine, setSlashLine] = useState(null);
  const fruitIdRef = useRef(0);
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
      sliced: false,
    };

    setFruits(prev => [...prev, newFruit]);
  }, []);

  // 游戏循环
  useEffect(() => {
    const spawnInterval = setInterval(spawnFruit, 1000);
    
    let lastTime = Date.now();
    const gameLoop = () => {
      const now = Date.now();
      const dt = (now - lastTime) / 16; // 标准化到 60fps
      lastTime = now;
      
      setFruits(prev => {
        return prev
          .map(fruit => {
            if (fruit.sliced) return fruit;
            
            // 更新位置
            let newVy = fruit.vy + 0.4 * dt; // 重力
            let newVx = fruit.vx;
            let newY = fruit.y + fruit.vy * dt;
            let newX = fruit.x + fruit.vx * dt;
            
            // 边界反弹
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
          .filter(fruit => fruit.y < height + 100 && !fruit.sliced);
      });
      
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
  const sliceFruit = useCallback((fruitId) => {
    setFruits(prev => prev.map(fruit => {
      if (fruit.id === fruitId && !fruit.sliced) {
        setScore(s => s + 10);
        return { ...fruit, sliced: true };
      }
      return fruit;
    }));
  }, []);

  // 手势处理 - 滑动切水果
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (_, gesture) => {
        setSlashLine({ x1: gesture.x0, y1: gesture.y0, x2: gesture.x0, y2: gesture.y0 });
        checkSlice(gesture.x0, gesture.y0);
      },
      onPanResponderMove: (_, gesture) => {
        const { moveX, moveY } = gesture;
        setSlashLine({ x1: gesture.x0, y1: gesture.y0, x2: moveX, y2: moveY });
        checkSlice(moveX, moveY);
      },
      onPanResponderRelease: () => {
        setSlashLine(null);
      },
    })
  ).current;

  // 检查切中
  const checkSlice = useCallback((touchX, touchY) => {
    setFruits(prev => {
      let hit = false;
      const updated = prev.map(fruit => {
        if (fruit.sliced || hit) return fruit;
        
        // 计算距离
        const dist = Math.sqrt((touchX - fruit.x) ** 2 + (touchY - fruit.y) ** 2);
        if (dist < 60) {
          hit = true;
          setScore(s => s + 10);
          return { ...fruit, sliced: true };
        }
        return fruit;
      });
      return updated;
    });
  }, []);

  const resetGame = () => {
    setScore(0);
    setFruits([]);
    fruitIdRef.current = 0;
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
        <View
          key={fruit.id}
          style={[
            styles.fruit,
            {
              left: fruit.x - 30,
              top: fruit.y - 30,
              transform: [{ rotate: `${fruit.rotation}deg` }],
              opacity: fruit.sliced ? 0 : 1,
            },
          ]}
        >
          <Text style={styles.fruitEmoji}>{fruit.emoji}</Text>
        </View>
      ))}

      {/* 刀光效果 */}
      {slashLine && (
        <Svg style={styles.slash} pointerEvents="none">
          <Line
            x1={slashLine.x1}
            y1={slashLine.y1}
            x2={slashLine.x2}
            y2={slashLine.y2}
            stroke="rgba(255,255,255,0.8)"
            strokeWidth="4"
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
  fruitEmoji: {
    fontSize: 50,
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