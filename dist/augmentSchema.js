'use strict';

Object.defineProperty(exports, '__esModule', {
  value: true
});
exports.extractResolvers = exports.extractTypeMapFromSchema = exports.makeAugmentedExecutableSchema = exports.augmentedSchema = undefined;

var _values = require('babel-runtime/core-js/object/values');

var _values2 = _interopRequireDefault(_values);

var _keys = require('babel-runtime/core-js/object/keys');

var _keys2 = _interopRequireDefault(_keys);

var _graphqlTools = require('graphql-tools');

var _index = require('./index');

var _graphql = require('graphql');

function _interopRequireDefault(obj) {
  return obj && obj.__esModule ? obj : { default: obj };
}

var augmentedSchema = (exports.augmentedSchema = function augmentedSchema(
  typeMap,
  queryResolvers,
  mutationResolvers
) {
  var augmentedTypeMap = augmentTypeMap(typeMap);
  var augmentedResolvers = augmentResolvers(
    queryResolvers,
    mutationResolvers,
    augmentedTypeMap
  );
  return (0, _graphqlTools.makeExecutableSchema)({
    typeDefs: printTypeMap(augmentedTypeMap),
    resolvers: augmentedResolvers,
    resolverValidationOptions: {
      requireResolversForResolveType: false
    }
  });
});

var makeAugmentedExecutableSchema = (exports.makeAugmentedExecutableSchema = function makeAugmentedExecutableSchema(
  _ref
) {
  var typeDefs = _ref.typeDefs,
    resolvers = _ref.resolvers,
    logger = _ref.logger,
    allowUndefinedInResolve = _ref.allowUndefinedInResolve,
    resolverValidationOptions = _ref.resolverValidationOptions,
    directiveResolvers = _ref.directiveResolvers,
    schemaDirectives = _ref.schemaDirectives,
    parseOptions = _ref.parseOptions,
    inheritResolversFromInterfaces = _ref.inheritResolversFromInterfaces;

  var typeMap = extractTypeMapFromTypeDefs(typeDefs);
  var augmentedTypeMap = augmentTypeMap(typeMap);
  var queryResolvers = resolvers && resolvers.Query ? resolvers.Query : {};
  var mutationResolvers =
    resolvers && resolvers.Mutation ? resolvers.Mutation : {};
  var augmentedResolvers = augmentResolvers(
    queryResolvers,
    mutationResolvers,
    augmentedTypeMap
  );
  resolverValidationOptions.requireResolversForResolveType = false;
  return (0, _graphqlTools.makeExecutableSchema)({
    typeDefs: printTypeMap(augmentedTypeMap),
    resolvers: augmentedResolvers,
    logger: logger,
    allowUndefinedInResolve: allowUndefinedInResolve,
    resolverValidationOptions: resolverValidationOptions,
    directiveResolvers: directiveResolvers,
    schemaDirectives: schemaDirectives,
    parseOptions: parseOptions,
    inheritResolversFromInterfaces: inheritResolversFromInterfaces
  });
});

var extractTypeMapFromTypeDefs = function extractTypeMapFromTypeDefs(typeDefs) {
  // TODO: accept alternative typeDefs formats (arr of strings, ast, etc.)
  // into a single string for parse, add validatation
  var astNodes = (0, _graphql.parse)(typeDefs).definitions;
  return astNodes.reduce(function(acc, t) {
    acc[t.name.value] = t;
    return acc;
  }, {});
};

var extractTypeMapFromSchema = (exports.extractTypeMapFromSchema = function extractTypeMapFromSchema(
  schema
) {
  var typeMap = schema.getTypeMap();
  var astNode = {};
  return (0, _keys2.default)(typeMap).reduce(function(acc, t) {
    astNode = typeMap[t].astNode;
    if (astNode !== undefined) {
      acc[astNode.name.value] = astNode;
    }
    return acc;
  }, {});
});

var extractResolvers = (exports.extractResolvers = function extractResolvers(
  operationType
) {
  var operationTypeFields = operationType ? operationType.getFields() : {};
  var operations = (0, _keys2.default)(operationTypeFields);
  var resolver = {};
  return operations.length > 0
    ? operations.reduce(function(acc, t) {
        resolver = operationTypeFields[t].resolve;
        if (resolver !== undefined) acc[t] = resolver;
        return acc;
      }, {})
    : {};
});

var augmentTypeMap = function augmentTypeMap(typeMap) {
  var types = (0, _keys2.default)(typeMap);
  typeMap = initializeOperationTypes(types, typeMap);
  var queryMap = createOperationMap(typeMap.Query);
  var mutationMap = createOperationMap(typeMap.Mutation);
  var astNode = {};
  types.forEach(function(t) {
    astNode = typeMap[t];
    if (isTypeForAugmentation(astNode)) {
      astNode = augmentType(astNode, typeMap);
      typeMap = possiblyAddQuery(astNode, typeMap, queryMap);
      typeMap = possiblyAddOrderingEnum(astNode, typeMap);
      typeMap = possiblyAddTypeMutations(astNode, typeMap, mutationMap);
      typeMap = possiblyAddRelationMutations(astNode, typeMap, mutationMap);
      typeMap[t] = astNode;
    }
  });
  typeMap = augmentQueryArguments(typeMap);
  return typeMap;
};

var possiblyAddTypeMutations = function possiblyAddTypeMutations(
  astNode,
  typeMap,
  mutationMap
) {
  typeMap = possiblyAddTypeMutation('Create', astNode, typeMap, mutationMap);
  typeMap = possiblyAddTypeMutation('Update', astNode, typeMap, mutationMap);
  typeMap = possiblyAddTypeMutation('Delete', astNode, typeMap, mutationMap);
  return typeMap;
};

var augmentQueryArguments = function augmentQueryArguments(typeMap) {
  var queryMap = createOperationMap(typeMap.Query);
  var args = [];
  var valueTypeName = '';
  var valueType = {};
  var field = {};
  var queryNames = (0, _keys2.default)(queryMap);
  if (queryNames.length > 0) {
    queryNames.forEach(function(t) {
      field = queryMap[t];
      valueTypeName = getNamedType(field).name.value;
      valueType = typeMap[valueTypeName];
      if (isTypeForAugmentation(valueType) && isListType(field)) {
        args = field.arguments;
        queryMap[t].arguments = possiblyAddArgument(args, 'first', 'Int');
        queryMap[t].arguments = possiblyAddArgument(args, 'offset', 'Int');
        queryMap[t].arguments = possiblyAddArgument(
          args,
          'orderBy',
          '_' + valueTypeName + 'Ordering'
        );
      }
    });
    typeMap.Query.fields = (0, _values2.default)(queryMap);
  }
  return typeMap;
};

var createOperationMap = function createOperationMap(type) {
  var fields = type ? type.fields : [];
  return fields.reduce(function(acc, t) {
    acc[t.name.value] = t;
    return acc;
  }, {});
};

var printTypeMap = function printTypeMap(typeMap) {
  return (0, _graphql.print)({
    kind: 'Document',
    definitions: (0, _values2.default)(typeMap)
  });
};

var augmentResolvers = function augmentResolvers(
  queryResolvers,
  mutationResolvers,
  typeMap
) {
  var resolvers = {};
  var queryMap = createOperationMap(typeMap.Query);
  queryResolvers = possiblyAddResolvers(queryMap, queryResolvers);
  if ((0, _keys2.default)(queryResolvers).length > 0) {
    resolvers.Query = queryResolvers;
  }
  var mutationMap = createOperationMap(typeMap.Mutation);
  mutationResolvers = possiblyAddResolvers(mutationMap, mutationResolvers);
  if ((0, _keys2.default)(mutationResolvers).length > 0) {
    resolvers.Mutation = mutationResolvers;
  }
  return resolvers;
};

var possiblyAddResolvers = function possiblyAddResolvers(
  operationTypeMap,
  resolvers
) {
  var operationName = '';
  return (0, _keys2.default)(operationTypeMap).reduce(function(acc, t) {
    // if no resolver provided for this operation type field
    operationName = operationTypeMap[t].name.value;
    if (acc[operationName] === undefined) {
      acc[operationName] = _index.neo4jgraphql;
    }
    return acc;
  }, resolvers);
};

var possiblyAddQuery = function possiblyAddQuery(astNode, typeMap, queryMap) {
  var name = astNode.name.value;
  if (queryMap[name] === undefined) {
    typeMap.Query.fields.push({
      kind: 'FieldDefinition',
      name: {
        kind: 'Name',
        value: name
      },
      arguments: createQueryArguments(astNode, typeMap),
      type: {
        kind: 'ListType',
        type: {
          kind: 'NamedType',
          name: {
            kind: 'Name',
            value: name
          }
        }
      },
      directives: []
    });
  }
  return typeMap;
};

var possiblyAddOrderingEnum = function possiblyAddOrderingEnum(
  astNode,
  typeMap
) {
  var name = '_' + astNode.name.value + 'Ordering';
  var values = createOrderingFields(astNode.fields, typeMap);
  // Add ordering enum if it does not exist already and if
  // there is at least one basic scalar field on this type
  if (typeMap[name] === undefined && values.length > 0) {
    typeMap[name] = {
      kind: 'EnumTypeDefinition',
      name: {
        kind: 'Name',
        value: name
      },
      directives: [],
      values: values
    };
  }
  return typeMap;
};

var initializeOperationTypes = function initializeOperationTypes(
  types,
  typeMap
) {
  if (types.length > 0) {
    typeMap = possiblyAddObjectType(typeMap, 'Query');
    typeMap = possiblyAddObjectType(typeMap, 'Mutation');
  }
  return typeMap;
};

var augmentType = function augmentType(astNode, typeMap) {
  astNode.fields = addOrReplaceNodeIdField(astNode, 'ID');
  astNode.fields = possiblyAddTypeFieldArguments(astNode, typeMap);
  return astNode;
};

var isListType = function isListType(type) {
  var isList =
    arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;

  // Only checks that there is at least one ListType on the way
  // to the NamedType
  if (!isKind(type, 'NamedType')) {
    if (isKind(type, 'ListType')) {
      isList = true;
    }
    return isListType(type.type, isList);
  }
  return isList;
};

var possiblyAddTypeFieldArguments = function possiblyAddTypeFieldArguments(
  astNode,
  typeMap
) {
  var fields = astNode.fields;
  var relationTypeName = '';
  var relationType = {};
  var args = [];
  fields.forEach(function(field) {
    relationTypeName = getNamedType(field).name.value;
    relationType = typeMap[relationTypeName];
    if (
      isTypeForAugmentation(relationType) &&
      isListType(field) &&
      (getDirective(field, 'relation') || getDirective(field, 'cypher'))
    ) {
      args = field.arguments;
      field.arguments = possiblyAddArgument(args, 'first', 'Int');
      field.arguments = possiblyAddArgument(args, 'offset', 'Int');
      field.arguments = possiblyAddArgument(
        args,
        'orderBy',
        '_' + relationTypeName + 'Ordering'
      );
    }
  });
  return fields;
};

var possiblyAddArgument = function possiblyAddArgument(
  args,
  fieldName,
  fieldType
) {
  var fieldIndex = args.findIndex(function(e) {
    return e.name.value === fieldName;
  });
  if (fieldIndex === -1) {
    args.push({
      kind: 'InputValueDefinition',
      name: {
        kind: 'Name',
        value: fieldName
      },
      type: {
        kind: 'NamedType',
        name: {
          kind: 'Name',
          value: fieldType
        }
      },
      directives: []
    });
  }
  return args;
};

var possiblyAddTypeMutation = function possiblyAddTypeMutation(
  namePrefix,
  astNode,
  typeMap,
  mutationMap
) {
  var typeName = astNode.name.value;
  var mutationName = namePrefix + typeName;
  // Only generate if the mutation named mutationName does not already exist
  if (mutationMap[mutationName] === undefined) {
    var args = buildAllFieldArguments(namePrefix, astNode, typeMap);
    if (args.length > 0) {
      typeMap.Mutation.fields.push({
        kind: 'FieldDefinition',
        name: {
          kind: 'Name',
          value: mutationName
        },
        arguments: args,
        type: {
          kind: 'NamedType',
          name: {
            kind: 'Name',
            value: typeName
          }
        },
        directives: []
      });
    }
  }
  return typeMap;
};

var isNonNullType = function isNonNullType(type) {
  var isRequired =
    arguments.length > 1 && arguments[1] !== undefined ? arguments[1] : false;
  var parent =
    arguments.length > 2 && arguments[2] !== undefined ? arguments[2] : {};

  if (!isKind(type, 'NamedType')) {
    return isNonNullType(type.type, isRequired, type);
  }
  if (isKind(parent, 'NonNullType')) {
    isRequired = true;
  }
  return isRequired;
};

var isKind = function isKind(type, kind) {
  return type && type.kind === kind;
};

var buildAllFieldArguments = function buildAllFieldArguments(
  namePrefix,
  astNode,
  typeMap
) {
  var fields = [];
  var type = {};
  var fieldName = '';
  var valueTypeName = '';
  var valueType = {};
  switch (namePrefix) {
    case 'Create': {
      var _firstIdField = undefined;
      astNode.fields.reduce(function(acc, t) {
        type = getNamedType(t);
        fieldName = t.name.value;
        valueTypeName = type.name.value;
        valueType = typeMap[valueTypeName];
        // If this field is not _id, and not a list,
        // and is not computed, and either a basic scalar
        // or an enum
        if (
          fieldName !== '_id' &&
          !isListType(t) &&
          !getDirective(t, 'cypher') &&
          (isBasicScalar(valueTypeName) ||
            isKind(valueType, 'EnumTypeDefinition'))
        ) {
          // Require if required
          if (isNonNullType(t)) {
            // Regardless of whether it is NonNullType,
            // don't require the first ID field discovered
            if (valueTypeName === 'ID' && !_firstIdField) {
              // will only be true once, this field will
              // by default recieve an auto-generated uuid,
              // if no value is provided
              _firstIdField = t;
              acc.push({
                kind: 'InputValueDefinition',
                name: {
                  kind: 'Name',
                  value: fieldName
                },
                type: type,
                directives: []
              });
            } else {
              acc.push({
                kind: 'InputValueDefinition',
                name: {
                  kind: 'Name',
                  value: fieldName
                },
                type: {
                  kind: 'NonNullType',
                  type: type
                },
                directives: []
              });
            }
          } else {
            acc.push({
              kind: 'InputValueDefinition',
              name: {
                kind: 'Name',
                value: fieldName
              },
              type: type,
              directives: []
            });
          }
        }
        return acc;
      }, fields);
      break;
    }
    case 'Update': {
      var primaryKey = getPrimaryKey(astNode);
      var augmentedFields = [];
      if (primaryKey) {
        // Primary key field is first field and required
        var primaryKeyName = primaryKey.name.value;
        var primaryKeyType = getNamedType(primaryKey);
        augmentedFields.push({
          kind: 'InputValueDefinition',
          name: {
            kind: 'Name',
            value: primaryKeyName
          },
          type: {
            kind: 'NonNullType',
            type: primaryKeyType
          },
          directives: []
        });
        astNode.fields.reduce(function(acc, t) {
          type = getNamedType(t);
          fieldName = t.name.value;
          valueTypeName = type.name.value;
          valueType = typeMap[valueTypeName];
          // If this field is not the primary key, and not _id,
          // and not a list, and not computed, and either a basic
          // scalar or an enum
          if (
            fieldName !== primaryKeyName &&
            fieldName !== '_id' &&
            !isListType(t) &&
            !getDirective(t, 'cypher') &&
            (isBasicScalar(valueTypeName) ||
              isKind(valueType, 'EnumTypeDefinition'))
          ) {
            acc.push({
              kind: 'InputValueDefinition',
              name: {
                kind: 'Name',
                value: fieldName
              },
              type: type,
              directives: []
            });
          }
          return acc;
        }, augmentedFields);
        // Use if there is at least one field other than
        // the primaryKey field used for node selection
        if (augmentedFields.length > 1) {
          fields = augmentedFields;
        }
      }
      break;
    }
    case 'Delete': {
      var _primaryKey = getPrimaryKey(astNode);
      var _primaryKeyName = _primaryKey.name.value;
      var _primaryKeyType = getNamedType(_primaryKey);
      fields.push({
        kind: 'InputValueDefinition',
        name: {
          kind: 'Name',
          value: _primaryKeyName
        },
        type: {
          kind: 'NonNullType',
          type: {
            kind: 'NamedType',
            name: {
              kind: 'Name',
              value: _primaryKeyType.name.value
            }
          }
        },
        directives: []
      });
      break;
    }
  }
  return fields;
};

var firstNonNullAndIdField = function firstNonNullAndIdField(fields) {
  var valueTypeName = '';
  return fields.find(function(e) {
    valueTypeName = getNamedType(e).name.value;
    return (
      e.name.value !== '_id' &&
      e.type.kind === 'NonNullType' &&
      valueTypeName === 'ID'
    );
  });
};

var firstIdField = function firstIdField(fields) {
  var valueTypeName = '';
  return fields.find(function(e) {
    valueTypeName = getNamedType(e).name.value;
    return e.name.value !== '_id' && valueTypeName === 'ID';
  });
};

var firstNonNullField = function firstNonNullField(fields) {
  var valueTypeName = '';
  return fields.find(function(e) {
    valueTypeName = getNamedType(e).name.value;
    return valueTypeName === 'NonNullType';
  });
};

var firstField = function firstField(fields) {
  return fields.find(function(e) {
    return e.name.value !== '_id';
  });
};

var getPrimaryKey = function getPrimaryKey(astNode) {
  var fields = astNode.fields;
  var pk = firstNonNullAndIdField(fields);
  if (!pk) {
    pk = firstIdField(fields);
  }
  if (!pk) {
    pk = firstNonNullField(fields);
  }
  if (!pk) {
    pk = firstField(fields);
  }
  return pk;
};

var capitalizeName = function capitalizeName(name) {
  return name.charAt(0).toUpperCase() + name.substr(1);
};
var possiblyAddRelationMutations = function possiblyAddRelationMutations(
  astNode,
  typeMap,
  mutationMap
) {
  var typeName = astNode.name.value;
  var relationTypeName = '';
  var relationDirective = {};
  var relationName = '';
  var direction = '';
  var capitalizedFieldName = '';
  astNode.fields.forEach(function(e) {
    relationDirective = getDirective(e, 'relation');
    if (relationDirective) {
      relationName = getRelationName(relationDirective);
      direction = getRelationDirection(relationDirective);
      relationTypeName = getNamedType(e).name.value;
      capitalizedFieldName = capitalizeName(e.name.value);
      possiblyAddRelationMutationField(
        'Add' + typeName + capitalizedFieldName,
        astNode,
        typeName,
        relationTypeName,
        direction,
        relationName,
        typeMap,
        mutationMap
      );
      possiblyAddRelationMutationField(
        'Remove' + typeName + capitalizedFieldName,
        astNode,
        typeName,
        relationTypeName,
        direction,
        relationName,
        typeMap,
        mutationMap
      );
    }
  });
  return typeMap;
};

var getDirective = function getDirective(field, directive) {
  return (
    field &&
    field.directives.find(function(e) {
      return e.name.value === directive;
    })
  );
};

var buildRelationMutationArguments = function buildRelationMutationArguments(
  astNode,
  relationTypeName,
  typeMap
) {
  var relationAstNode = typeMap[relationTypeName];
  if (relationAstNode) {
    var primaryKey = getPrimaryKey(astNode);
    var relationPrimaryKey = getPrimaryKey(relationAstNode);
    var relationType = getNamedType(relationPrimaryKey);
    return [
      {
        kind: 'InputValueDefinition',
        name: {
          kind: 'Name',
          value: astNode.name.value.toLowerCase() + primaryKey.name.value
        },
        type: {
          kind: 'NonNullType',
          type: getNamedType(primaryKey)
        },
        directives: []
      },
      {
        kind: 'InputValueDefinition',
        name: {
          kind: 'Name',
          value:
            relationAstNode.name.value.toLowerCase() +
            relationPrimaryKey.name.value
        },
        type: {
          kind: 'NonNullType',
          type: relationType
        },
        directives: []
      }
    ];
  }
};

var possiblyAddRelationMutationField = function possiblyAddRelationMutationField(
  mutationName,
  astNode,
  typeName,
  relationTypeName,
  direction,
  name,
  typeMap,
  mutationMap
) {
  // Only generate if the mutation named mutationName does not already exist,
  // and only generate for one direction, OUT, in order to prevent duplication
  if (
    mutationMap[mutationName] === undefined &&
    (direction === 'OUT' || direction === 'out')
  ) {
    typeMap.Mutation.fields.push({
      kind: 'FieldDefinition',
      name: {
        kind: 'Name',
        value: mutationName
      },
      arguments: buildRelationMutationArguments(
        astNode,
        relationTypeName,
        typeMap
      ),
      type: {
        kind: 'NamedType',
        name: {
          kind: 'Name',
          value: typeName
        }
      },
      directives: [
        {
          kind: 'Directive',
          name: {
            kind: 'Name',
            value: 'MutationMeta'
          },
          arguments: [
            {
              kind: 'Argument',
              name: {
                kind: 'Name',
                value: 'relationship'
              },
              value: {
                kind: 'StringValue',
                value: name
              }
            },
            {
              kind: 'Argument',
              name: {
                kind: 'Name',
                value: 'from'
              },
              value: {
                kind: 'StringValue',
                value: typeName
              }
            },
            {
              kind: 'Argument',
              name: {
                kind: 'Name',
                value: 'to'
              },
              value: {
                kind: 'StringValue',
                value: relationTypeName
              }
            }
          ]
        }
      ]
    });
  }
  return typeMap;
};

var addOrReplaceNodeIdField = function addOrReplaceNodeIdField(
  astNode,
  valueType
) {
  var fields = astNode ? astNode.fields : [];
  var index = fields.findIndex(function(e) {
    return e.name.value === '_id';
  });
  var definition = {
    kind: 'FieldDefinition',
    name: {
      kind: 'Name',
      value: '_id'
    },
    arguments: [],
    type: {
      kind: 'NamedType',
      name: {
        kind: 'Name',
        value: valueType
      }
    },
    directives: []
  };
  // If it has already been provided, replace it to force valueType,
  // else add it as the last field
  index >= 0 ? fields.splice(index, 1, definition) : fields.push(definition);
  return fields;
};

var getRelationName = function getRelationName(relationDirective) {
  var name = {};
  try {
    name = relationDirective.arguments.filter(function(a) {
      return a.name.value === 'name';
    })[0];
  } catch (e) {
    // FIXME: should we ignore this error to define default behavior?
    throw new Error('No name argument specified on @relation directive');
  }
  return name.value.value;
};

var getRelationDirection = function getRelationDirection(relationDirective) {
  var direction = {};
  try {
    direction = relationDirective.arguments.filter(function(a) {
      return a.name.value === 'direction';
    })[0];
  } catch (e) {
    // FIXME: should we ignore this error to define default behavior?
    throw new Error('No direction argument specified on @relation directive');
  }
  return direction.value.value;
};

var possiblyAddObjectType = function possiblyAddObjectType(typeMap, name) {
  if (typeMap[name] === undefined) {
    typeMap[name] = {
      kind: 'ObjectTypeDefinition',
      name: {
        kind: 'Name',
        value: name
      },
      interfaces: [],
      directives: [],
      fields: []
    };
  }
  return typeMap;
};

var isBasicScalar = function isBasicScalar(name) {
  return (
    name === 'ID' ||
    name === 'String' ||
    name === 'Float' ||
    name === 'Int' ||
    name === 'Boolean'
  );
};

var isQueryArgumentFieldType = function isQueryArgumentFieldType(
  type,
  valueType
) {
  return (
    isBasicScalar(type.name.value) || isKind(valueType, 'EnumTypeDefinition')
  );
};

var createQueryArguments = function createQueryArguments(astNode, typeMap) {
  var type = {};
  var valueTypeName = '';
  astNode.fields = addOrReplaceNodeIdField(astNode, 'Int');
  return astNode.fields.reduce(function(acc, t) {
    type = getNamedType(t);
    valueTypeName = type.name.value;
    if (isQueryArgumentFieldType(type, typeMap[valueTypeName])) {
      acc.push({
        kind: 'InputValueDefinition',
        name: {
          kind: 'Name',
          value: t.name.value
        },
        type: type,
        directives: []
      });
    }
    return acc;
  }, []);
};

var isTypeForAugmentation = function isTypeForAugmentation(astNode) {
  // TODO: check for @ignore and @model directives
  return (
    astNode &&
    astNode.kind === 'ObjectTypeDefinition' &&
    astNode.name.value !== 'Query' &&
    astNode.name.value !== 'Mutation'
  );
};

var getNamedType = function getNamedType(type) {
  if (type.kind !== 'NamedType') {
    return getNamedType(type.type);
  }
  return type;
};

var createOrderingFields = function createOrderingFields(fields, typeMap) {
  var type = {};
  return fields.reduce(function(acc, t) {
    type = getNamedType(t);
    if (isBasicScalar(type.name.value)) {
      acc.push({
        kind: 'EnumValueDefinition',
        name: {
          kind: 'Name',
          value: t.name.value + '_asc'
        },
        directives: []
      });
      acc.push({
        kind: 'EnumValueDefinition',
        name: {
          kind: 'Name',
          value: t.name.value + '_desc'
        },
        directives: []
      });
    }
    return acc;
  }, []);
};
