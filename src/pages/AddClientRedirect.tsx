import React, { useEffect } from 'react';
import { AddClient } from './AddClient';

const AddClientRedirect: React.FC = () => {
  useEffect(() => {
    console.log('AddClientRedirect component mounted');
  }, []);

  return <AddClient />;
};

export default AddClientRedirect;
