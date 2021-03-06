'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});

var _extends2 = require('babel-runtime/helpers/extends');

var _extends3 = _interopRequireDefault(_extends2);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _toArray2 = require('babel-runtime/helpers/toArray');

var _toArray3 = _interopRequireDefault(_toArray2);

var _slicedToArray2 = require('babel-runtime/helpers/slicedToArray');

var _slicedToArray3 = _interopRequireDefault(_slicedToArray2);

var _entries = require('babel-runtime/core-js/object/entries');

var _entries2 = _interopRequireDefault(_entries);

exports.buildCypherSelection = buildCypherSelection;

var _utils = require('./utils');

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

function buildCypherSelection(_ref) {
  var initial = _ref.initial,
    selections = _ref.selections,
    variableName = _ref.variableName,
    schemaType = _ref.schemaType,
    resolveInfo = _ref.resolveInfo,
    _ref$paramIndex = _ref.paramIndex,
    paramIndex = _ref$paramIndex === undefined ? 1 : _ref$paramIndex;

  if (!selections.length) {
    return [initial, {}];
  }

  var filterParams = (0, _utils.getFilterParams)(
    (0, _utils.filtersFromSelections)(selections, resolveInfo.variableValues),
    paramIndex
  );
  var shallowFilterParams = (0, _entries2.default)(filterParams).reduce(
    function(result, _ref2) {
      var _ref3 = (0, _slicedToArray3.default)(_ref2, 2),
        key = _ref3[0],
        value = _ref3[1];

      result[value.index + '-' + key] = value.value;
      return result;
    },
    {}
  );

  var _selections = (0, _toArray3.default)(selections),
    headSelection = _selections[0],
    tailSelections = _selections.slice(1);

  var tailParams = {
    selections: tailSelections,
    variableName: variableName,
    schemaType: schemaType,
    resolveInfo: resolveInfo
  };

  var recurse = function recurse(args) {
    paramIndex =
      (0, _keys2.default)(shallowFilterParams).length > 0
        ? paramIndex + 1
        : paramIndex;

    var _buildCypherSelection = buildCypherSelection(
        (0, _extends3.default)({}, args, { paramIndex: paramIndex })
      ),
      _buildCypherSelection2 = (0, _slicedToArray3.default)(
        _buildCypherSelection,
        2
      ),
      subSelection = _buildCypherSelection2[0],
      subFilterParams = _buildCypherSelection2[1];

    return [
      subSelection,
      (0, _extends3.default)({}, shallowFilterParams, subFilterParams)
    ];
  };

  var fieldName = headSelection.name.value;
  var commaIfTail = tailSelections.length > 0 ? ',' : '';

  // Schema meta fields(__schema, __typename, etc)
  if (!schemaType.getFields()[fieldName]) {
    return recurse(
      (0, _extends3.default)(
        {
          initial: tailSelections.length
            ? initial
            : initial.substring(0, initial.lastIndexOf(','))
        },
        tailParams
      )
    );
  }

  var fieldType = schemaType.getFields()[fieldName].type;
  var innerSchemaType = (0, _utils.innerType)(fieldType); // for target "type" aka label

  var _cypherDirective = (0, _utils.cypherDirective)(schemaType, fieldName),
    customCypher = _cypherDirective.statement;

  // Removed This Because It Was Returning The Neo4j Node ID and Not a Property Called _id I needed
  // Database meta fields(_id)
  //if (fieldName === '_id') {
  //return recurse({
  //initial: `${initial}${fieldName}: ID(${variableName})${commaIfTail}`,
  //...tailParams
  //});
  //}

  // Main control flow

  if ((0, _utils.isGraphqlScalarType)(innerSchemaType)) {
    if (customCypher) {
      return recurse(
        (0, _extends3.default)(
          {
            initial:
              '' +
              initial +
              fieldName +
              ': apoc.cypher.runFirstColumn("' +
              customCypher +
              '", ' +
              (0, _utils.cypherDirectiveArgs)(
                variableName,
                headSelection,
                schemaType,
                resolveInfo
              ) +
              ', false)' +
              commaIfTail
          },
          tailParams
        )
      );
    }

    // graphql scalar type, no custom cypher statement
    return recurse(
      (0, _extends3.default)(
        {
          initial: initial + ' .' + fieldName + ' ' + commaIfTail
        },
        tailParams
      )
    );
  }

  // We have a graphql object type

  var nestedVariable = variableName + '_' + fieldName;
  var skipLimit = (0, _utils.computeSkipLimit)(
    headSelection,
    resolveInfo.variableValues
  );

  var subSelections = (0, _utils.extractSelections)(
    headSelection.selectionSet.selections,
    resolveInfo.fragments
  );

  var subSelection = recurse({
    initial: '',
    selections: subSelections,
    variableName: nestedVariable,
    schemaType: innerSchemaType,
    resolveInfo: resolveInfo
  });

  var selection = void 0;

  if (customCypher) {
    // similar: [ x IN apoc.cypher.runFirstColumn("WITH {this} AS this MATCH (this)--(:Genre)--(o:Movie) RETURN o", {this: movie}, true) |x {.title}][1..2])
    var fieldIsList = !!fieldType.ofType;

    selection = recurse(
      (0, _extends3.default)(
        {
          initial:
            '' +
            initial +
            fieldName +
            ': ' +
            (fieldIsList ? '' : 'head(') +
            '[ ' +
            nestedVariable +
            ' IN apoc.cypher.runFirstColumn("' +
            customCypher +
            '", ' +
            (0, _utils.cypherDirectiveArgs)(
              variableName,
              headSelection,
              schemaType,
              resolveInfo
            ) +
            ', true) | ' +
            nestedVariable +
            ' {' +
            subSelection[0] +
            '}]' +
            (fieldIsList ? '' : ')') +
            skipLimit +
            ' ' +
            commaIfTail
        },
        tailParams
      )
    );
  } else {
    // graphql object type, no custom cypher

    var _relationDirective = (0, _utils.relationDirective)(
        schemaType,
        fieldName
      ),
      relType = _relationDirective.name,
      relDirection = _relationDirective.direction;

    var queryParams = (0, _utils.innerFilterParams)(filterParams);

    selection = recurse(
      (0, _extends3.default)(
        {
          initial:
            '' +
            initial +
            fieldName +
            ': ' +
            (!(0, _utils.isArrayType)(fieldType) ? 'head(' : '') +
            '[(' +
            variableName +
            ')' +
            (relDirection === 'in' || relDirection === 'IN' ? '<' : '') +
            '-[:' +
            relType +
            ']-' +
            (relDirection === 'out' || relDirection === 'OUT' ? '>' : '') +
            '(' +
            nestedVariable +
            ':' +
            innerSchemaType.name +
            queryParams +
            ') | ' +
            nestedVariable +
            ' {' +
            subSelection[0] +
            '}]' +
            (!(0, _utils.isArrayType)(fieldType) ? ')' : '') +
            skipLimit +
            ' ' +
            commaIfTail
        },
        tailParams
      )
    );
  }

  return [
    selection[0],
    (0, _extends3.default)({}, selection[1], subSelection[1])
  ];
}
