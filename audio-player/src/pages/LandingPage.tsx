import React, { useState } from 'react';
import styled from '@emotion/styled';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: #1a1a1a;
  color: #ffffff;
`;

const Title = styled.h1`
  font-size: 2rem;
  margin-bottom: 2rem;
`;

const AudioContainer = styled.div`
  background-color: #2a2a2a;
  padding: 2rem;
  border-radius: 8px;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
  width: 100%;
  max-width: 400px;
`;

const StatusText = styled.p`
  text-align: center;
  color: #888;
  margin: 1rem 0;
`;

const LandingPage: React.FC = () => {
  const [isConnected, setIsConnected] = useState(false);

  return (
    <Container>
      <Title>Orpheus Audio Player</Title>
      <AudioContainer>
        <StatusText>
          {isConnected ? 'Connected to audio stream' : 'Waiting for audio stream...'}
        </StatusText>
      </AudioContainer>
    </Container>
  );
};

export default LandingPage; 