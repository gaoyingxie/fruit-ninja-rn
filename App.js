import React, { useState, useEffect, useRef, useCallback } from 'react';
import { StyleSheet, View, Text, Dimensions, Animated, PanResponder, TouchableOpacity } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import Svg, { Line, Circle } from 'react-native-svg';

const { width, height } = Dimensions.get('window');
const FRUIT_EMOJIS = ['🍎', '🍊', '🍋', '🍉', '🍇', '🥝', '🍓', '🍑'];

export default function App() {
  const [score, setScore] = useState(0);
  const [fruits, setFruits] = useState([]);
  const [slashLine, setSlashLine] = useState(null);
  const fruitIdRef = useRef(0);
  const gameLoopRef = useRef(null);

  // 生成水果
  const spawnFruit = useCallback(() => {
    const id = fruitIdRef.current++;
    const emoji = FRUIT_EMOJIS[Math.floor(Math.random() * FRUIT_EMOJIS.length)];
    const startX = Math.random() * (width - 100) + 50;
    
    const newFruit = {
      id,
      emoji,
      x: new Animated.Value(startX),
      y: new Animated.Value(height + 50),
      vx: (Math.random() - 0.5) * 4,
      vy: -Math.random() * 10 - 12,
      rotation: new Animated.Value(0),
      vRotation: (Math.random() - 0.5) * 10,
      scale: new Animated.Value(1),
      sliced: false,
    };

    setFruits(prev => [...prev, newFruit]);
  }, []);

  // 游戏循环
  useEffect(() => {
    const spawnInterval = setInterval(spawnFruit, 1200);
    
    gameLoopRef.current = setInterval(() => {
      setFruits(prev => {
        return prev.map(fruit => {
          // 更新位置
          const currentY = fruit.y.__getValue ? fruit.y.__getValue() : height + 50;
          const currentX = fruit.x.__getValue ? fruit.x.__getValue() : width / 2;
          
          let newVy = fruit.vy + 0.3; // 重力
          let newVx = fruit.vx;
          let newY = currentY + newVy;
          let newX = currentX + newVx;
          
          // 边界反弹
          if (newX < 30 || newX > width - 30) {
            newVx = -newVx * 0.8;
            newX = Math.max(30, Math.min(width - 30, newX));
          }

          fruit.y.setValue(newY);
          fruit.x.setValue(newX);
          fruit.vy = newVy;
          fruit.vx = newVx;

          // 旋转
          const currentRot = fruit.rotation.__getValue ? fruit.rotation.__getValue() : 0;
          fruit.rotation.setValue(currentRot + fruit.vRotation);

          return fruit;
        }).filter(fruit => {
          const y = fruit.y.__getValue ? fruit.y.__getValue() : 0;
          return y < height + 100 && !fruit.sliced;
        });
      });
    }, 16);

    return () => {
      clearInterval(spawnInterval);
      clearInterval(gameLoopRef.current);
    };
  }, [spawnFruit]);

  // 切水果
  const sliceFruit = (fruitId) => {
    setFruits(prev => prev.map(fruit => {
      if (fruit.id === fruitId && !fruit.sliced) {
        setScore(s => s + 10);
        // 切中动画
        Animated.sequence([
          Animated.timing(fruit.scale, {
            toValue: 1.5,
            duration: 100,
            useNativeDriver: true,
          }),
          Animated.timing(fruit.scale, {
            toValue: 0,
            duration: 200,
            useNativeDriver: true,
          }),
        ]).start();
        return { ...fruit, sliced: true };
      }
      return fruit;
    }));
  };

  // 手势处理 - 滑动切水果
  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: () => true,
      onPanResponderMove: (_, gesture) => {
        const { moveX, moveY } = gesture;
        setSlashLine({ x1: moveX - gesture.dx, y1: moveY - gesture.dy, x2: moveX, y2: moveY });
        
        // 检查是否切中水果
        fruits.forEach(fruit => {
          const fx = fruit.x.__getValue ? fruit.x.__getValue() : 0;
          const fy = fruit.y.__getValue ? fruit.y.__getValue() : 0;
          const dist = Math.sqrt((moveX - fx) ** 2 + (moveY - fy) ** 2);
          if (dist < 50) {
            sliceFruit(fruit.id);
          }
        });
      },
      onPanResponderRelease: () => {
        setSlashLine(null);
      },
    })
  ).current;

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
        <Animated.View
          key={fruit.id}
          style={[
            styles.fruit,
            {
              transform: [
                { translateX: fruit.x },
                { translateY: fruit.y },
                { rotate: fruit.rotation.interpolate({
                  inputRange: [0, 360],
                  outputRange: ['0deg', '360deg']
                })},
                { scale: fruit.scale }
              ],
            },
          ]}
        >
          <Text style={styles.fruitEmoji}>{fruit.emoji}</Text>
        </Animated.View>
      ))}

      {/* 刀光效果 */}
      {slashLine && (
        <Svg style={styles.slash}>
          <Line
            x1={slashLine.x1}
            y1={slashLine.y1}
            x2={slashLine.x2}
            y2={slashLine.y2}
            stroke="white"
            strokeWidth="3"
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
    marginLeft: -30,
    marginTop: -30,
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