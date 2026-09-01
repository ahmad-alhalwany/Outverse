const React = require('react');
const { View } = require('react-native');

function MapView({ children, style, ...props }) {
  return React.createElement(View, { ...props, style }, children);
}

function Marker({ children }) {
  return children || null;
}

function Callout({ children }) {
  return children || null;
}

module.exports = MapView;
module.exports.default = MapView;
module.exports.Marker = Marker;
module.exports.Callout = Callout;
