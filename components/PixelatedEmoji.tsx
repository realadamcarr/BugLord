import React from 'react';
import { StyleSheet, View } from 'react-native';

export type PixelEmojiType = 
  | 'bug' 
  | 'train' 
  | 'party' 
  | 'walk' 
  | 'hive' 
  | 'item' 
  | 'stat' 
  | 'rare' 
  | 'biom' 
  | 'ach' 
  | 'dex' 
  | 'col' 
  | 'info' 
  | 'bell' 
  | 'stop' 
  | 'del' 
  | 'ppl' 
  | 'gem' 
  | 'map' 
  | 'up';

interface PixelatedEmojiProps {
  type: PixelEmojiType;
  size?: number;
  color?: string;
}

const PixelatedEmoji: React.FC<PixelatedEmojiProps> = ({ type, size = 16, color = '#000000' }) => {
  const pixelSize = Math.max(1, Math.floor(size / 8));
  
  const renderPixelGrid = (pattern: number[][]) => {
    return (
      <View style={[styles.container, { width: size, height: size }]}>
        {pattern.map((row, rowIndex) => (
          <View key={rowIndex} style={[styles.row, { height: pixelSize }]}>
            {row.map((pixel, colIndex) => (
              <View
                key={colIndex}
                style={[
                  styles.pixel,
                  {
                    width: pixelSize,
                    height: pixelSize,
                    backgroundColor: pixel === 1 ? color : 'transparent',
                  }
                ]}
              />
            ))}
          </View>
        ))}
      </View>
    );
  };

  const getPattern = (type: PixelEmojiType): number[][] => {
    switch (type) {
      case 'bug':
        return [
          [0, 0, 1, 1, 1, 1, 0, 0],
          [0, 1, 1, 1, 1, 1, 1, 0],
          [1, 1, 0, 1, 1, 0, 1, 1],
          [1, 1, 1, 1, 1, 1, 1, 1],
          [1, 1, 1, 0, 0, 1, 1, 1],
          [1, 1, 1, 1, 1, 1, 1, 1],
          [0, 1, 1, 1, 1, 1, 1, 0],
          [0, 0, 1, 0, 0, 1, 0, 0],
        ];
      
      case 'train':
        return [
          [1, 1, 1, 1, 1, 1, 1, 1],
          [1, 0, 1, 1, 1, 1, 0, 1],
          [1, 1, 1, 1, 1, 1, 1, 1],
          [1, 1, 0, 1, 1, 0, 1, 1],
          [1, 1, 1, 0, 0, 1, 1, 1],
          [1, 1, 0, 1, 1, 0, 1, 1],
          [1, 1, 1, 1, 1, 1, 1, 1],
          [0, 1, 0, 1, 1, 0, 1, 0],
        ];
      
      case 'party':
        return [
          [0, 0, 1, 1, 1, 1, 0, 0],
          [0, 1, 1, 1, 1, 1, 1, 0],
          [1, 1, 1, 1, 1, 1, 1, 1],
          [1, 1, 1, 0, 0, 1, 1, 1],
          [1, 1, 0, 1, 1, 0, 1, 1],
          [1, 1, 1, 1, 1, 1, 1, 1],
          [0, 1, 1, 0, 0, 1, 1, 0],
          [0, 0, 1, 1, 1, 1, 0, 0],
        ];
      
      case 'walk':
        return [
          [0, 0, 1, 1, 0, 0, 0, 0],
          [0, 1, 1, 1, 1, 0, 0, 0],
          [0, 0, 1, 1, 0, 0, 0, 0],
          [0, 1, 1, 1, 1, 0, 0, 0],
          [1, 1, 1, 1, 1, 1, 0, 0],
          [0, 0, 1, 1, 0, 0, 0, 0],
          [0, 0, 1, 0, 1, 0, 0, 0],
          [0, 1, 0, 0, 0, 1, 0, 0],
        ];
      
      case 'hive':
        return [
          [0, 0, 0, 1, 1, 0, 0, 0],
          [0, 0, 1, 1, 1, 1, 0, 0],
          [0, 1, 1, 1, 1, 1, 1, 0],
          [1, 1, 1, 0, 0, 1, 1, 1],
          [1, 1, 1, 0, 0, 1, 1, 1],
          [0, 1, 1, 1, 1, 1, 1, 0],
          [0, 0, 1, 1, 1, 1, 0, 0],
          [0, 0, 0, 1, 1, 0, 0, 0],
        ];
      
      case 'item':
        return [
          [0, 1, 1, 1, 1, 1, 1, 0],
          [1, 1, 0, 0, 0, 0, 1, 1],
          [1, 0, 1, 1, 1, 1, 0, 1],
          [1, 0, 1, 0, 0, 1, 0, 1],
          [1, 0, 1, 0, 0, 1, 0, 1],
          [1, 0, 1, 1, 1, 1, 0, 1],
          [1, 1, 0, 0, 0, 0, 1, 1],
          [0, 1, 1, 1, 1, 1, 1, 0],
        ];
      
      case 'stat':
        return [
          [0, 0, 0, 0, 0, 0, 1, 0],
          [0, 0, 0, 0, 0, 1, 1, 0],
          [0, 0, 0, 0, 1, 1, 1, 0],
          [0, 0, 0, 1, 1, 1, 1, 0],
          [0, 0, 1, 1, 1, 1, 1, 0],
          [0, 1, 1, 1, 1, 1, 1, 0],
          [1, 1, 1, 1, 1, 1, 1, 0],
          [1, 1, 1, 1, 1, 1, 1, 1],
        ];
      
      case 'rare':
        return [
          [0, 0, 0, 1, 0, 0, 0, 0],
          [0, 0, 1, 1, 1, 0, 0, 0],
          [0, 1, 1, 1, 1, 1, 0, 0],
          [1, 1, 1, 1, 1, 1, 1, 0],
          [0, 1, 1, 1, 1, 1, 0, 0],
          [0, 0, 1, 1, 1, 0, 0, 0],
          [0, 0, 0, 1, 0, 0, 0, 0],
          [0, 0, 0, 0, 0, 0, 0, 0],
        ];
      
      case 'dex':
        return [
          [1, 1, 1, 1, 1, 1, 1, 1],
          [1, 0, 0, 0, 0, 0, 0, 1],
          [1, 0, 1, 1, 1, 1, 0, 1],
          [1, 0, 1, 0, 0, 1, 0, 1],
          [1, 0, 1, 0, 0, 1, 0, 1],
          [1, 0, 1, 1, 1, 1, 0, 1],
          [1, 0, 0, 0, 0, 0, 0, 1],
          [1, 1, 1, 1, 1, 1, 1, 1],
        ];
      
      case 'info':
        return [
          [0, 1, 1, 1, 1, 1, 1, 0],
          [1, 1, 1, 1, 1, 1, 1, 1],
          [1, 1, 1, 0, 0, 1, 1, 1],
          [1, 1, 1, 0, 0, 1, 1, 1],
          [1, 1, 1, 0, 0, 1, 1, 1],
          [1, 1, 1, 1, 1, 1, 1, 1],
          [1, 1, 1, 0, 0, 1, 1, 1],
          [0, 1, 1, 1, 1, 1, 1, 0],
        ];
      
      case 'bell':
        return [
          [0, 0, 0, 1, 1, 0, 0, 0],
          [0, 0, 1, 1, 1, 1, 0, 0],
          [0, 1, 1, 1, 1, 1, 1, 0],
          [0, 1, 0, 1, 1, 0, 1, 0],
          [0, 1, 1, 1, 1, 1, 1, 0],
          [0, 1, 1, 1, 1, 1, 1, 0],
          [1, 1, 1, 1, 1, 1, 1, 1],
          [0, 0, 0, 1, 1, 0, 0, 0],
        ];
      
      case 'stop':
        return [
          [1, 1, 1, 1, 1, 1, 1, 1],
          [1, 1, 1, 1, 1, 1, 1, 1],
          [1, 1, 1, 1, 1, 1, 1, 1],
          [1, 1, 1, 1, 1, 1, 1, 1],
          [1, 1, 1, 1, 1, 1, 1, 1],
          [1, 1, 1, 1, 1, 1, 1, 1],
          [1, 1, 1, 1, 1, 1, 1, 1],
          [1, 1, 1, 1, 1, 1, 1, 1],
        ];

      default:
        // Default pattern for unknown types
        return [
          [1, 1, 1, 1, 1, 1, 1, 1],
          [1, 0, 1, 0, 1, 0, 1, 0],
          [1, 1, 1, 1, 1, 1, 1, 1],
          [1, 0, 1, 0, 1, 0, 1, 0],
          [1, 1, 1, 1, 1, 1, 1, 1],
          [1, 0, 1, 0, 1, 0, 1, 0],
          [1, 1, 1, 1, 1, 1, 1, 1],
          [1, 0, 1, 0, 1, 0, 1, 0],
        ];
    }
  };

  return renderPixelGrid(getPattern(type));
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'column',
  },
  row: {
    flexDirection: 'row',
  },
  pixel: {
    // Each pixel is rendered as a small square
  },
});

export default PixelatedEmoji;